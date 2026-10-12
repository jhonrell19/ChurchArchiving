import sqlite3
from pathlib import Path

backend_dir = Path(__file__).resolve().parent
db_path = (backend_dir / "instance" / "archive.db").resolve()

print("Using database:")
print(db_path)

if not db_path.exists():
    raise SystemExit(
        "archive.db was not found. Restore your existing database before running this migration."
    )

connection = sqlite3.connect(db_path)

try:
    cursor = connection.cursor()

    def table_columns(table_name: str) -> set[str]:
        cursor.execute(f"PRAGMA table_info({table_name})")
        return {row[1] for row in cursor.fetchall()}

    def add_missing_columns(table_name: str, columns: dict[str, str]):
        existing = table_columns(table_name)

        for column_name, definition in columns.items():
            if column_name not in existing:
                print(f"Adding {table_name}.{column_name}...")
                cursor.execute(
                    f"ALTER TABLE {table_name} "
                    f"ADD COLUMN {column_name} {definition}"
                )

    # Request ownership / urgent / demo-payment fields.
    add_missing_columns(
        "certificate_request",
        {
            "requester_user_id": "INTEGER",
            "requester_address": "VARCHAR(500)",
            "is_urgent": "BOOLEAN NOT NULL DEFAULT 0",
            "base_fee": "INTEGER NOT NULL DEFAULT 0",
            "urgent_fee": "INTEGER NOT NULL DEFAULT 0",
            "total_fee": "INTEGER NOT NULL DEFAULT 0",
            "payment_status": "VARCHAR(30) NOT NULL DEFAULT 'Unpaid'",
            "payment_method": "VARCHAR(50)",
            "payment_reference": "VARCHAR(100)",
            "paid_at": "DATETIME",
            "record_date_hint": "VARCHAR(100)",
            "record_details": "VARCHAR(500)",
        },
    )

    # Archive columns already used by models.py/server.py.
    # db.create_all() does NOT add them to an existing SQLite table.
    add_missing_columns(
        "document",
        {
            "file_hash": "VARCHAR(200)",
            "department": "VARCHAR(100)",
            "ocr_text": "TEXT",
            "extracted_metadata": "TEXT",
        },
    )

    cursor.execute(
        """
        CREATE INDEX IF NOT EXISTS
        ix_certificate_request_requester_user_id
        ON certificate_request(requester_user_id)
        """
    )

    cursor.execute(
        """
        CREATE INDEX IF NOT EXISTS
        ix_document_file_hash
        ON document(file_hash)
        """
    )

    # Normalize the old prototype category name so existing burial/death
    # records remain visible to the Burial Admin under the new system.
    cursor.execute(
        "UPDATE document SET sacrament_type = 'burial' "
        "WHERE sacrament_type = 'death'"
    )

    cursor.execute(
        "UPDATE certificate_request SET sacrament_type = 'burial' "
        "WHERE sacrament_type = 'death'"
    )

    # The old prototype stored the source archive scan in generated_file.
    # In the new release workflow, generated_file is reserved for the final
    # user-facing document only. Clear legacy source-file associations.
    cursor.execute(
        """
        UPDATE certificate_request
        SET generated_file = NULL,
            status = CASE WHEN status = 'Ready' THEN 'Approved' ELSE status END
        WHERE matched_document_id IS NOT NULL
          AND generated_file IS NOT NULL
          AND REPLACE(generated_file, '\\', '/') = (
              SELECT REPLACE(document.filepath, '\\', '/')
              FROM document
              WHERE document.id = certificate_request.matched_document_id
          )
          AND REPLACE(generated_file, '\\', '/') NOT LIKE 'uploads/releases/%'
        """
    )

    cursor.execute(
        """
        UPDATE certificate_request
        SET status = CASE
            WHEN matched_document_id IS NOT NULL THEN 'Approved'
            ELSE 'Pending'
        END
        WHERE status = 'Released'
          AND (payment_status != 'Paid' OR generated_file IS NULL)
        """
    )

    # Backfill the department for archive records that existed before
    # this column was introduced.
    cursor.execute(
        """
        UPDATE document
        SET department = 'main'
        WHERE sacrament_type IN ('baptismal', 'confirmation', 'marriage')
          AND (department IS NULL OR TRIM(department) = '')
        """
    )

    cursor.execute(
        """
        UPDATE document
        SET department = 'burial'
        WHERE sacrament_type IN ('burial', 'land_agreement')
          AND (department IS NULL OR TRIM(department) = '')
        """
    )

    connection.commit()

    final_request_columns = table_columns("certificate_request")
    required_request_columns = {
        "requester_user_id",
        "requester_address",
        "is_urgent",
        "base_fee",
        "urgent_fee",
        "total_fee",
        "payment_status",
        "payment_method",
        "payment_reference",
        "paid_at",
        "record_date_hint",
        "record_details",
    }
    missing = required_request_columns - final_request_columns

    if missing:
        raise SystemExit(
            "Migration verification failed. Missing columns: "
            + ", ".join(sorted(missing))
        )

    cursor.execute(
        "SELECT requester_user_id FROM certificate_request LIMIT 1"
    )
    cursor.fetchall()

    print()
    print("Migration completed successfully.")
    print("Request schema verified: requester_user_id OK")
    print("No existing archive records were deleted.")

finally:
    connection.close()
