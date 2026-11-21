# Parish bulletin release

Based on staging ba00fd0. Public pages and the three desks use parchment, terracotta and wine. The main office opens each archive category directly. Cemetery slot tiles preset the list filter. The parishioner desk keeps its primary tasks visible during loading or an outage.

## Website content

The designated main supervisor can use Main Admin → Website editor to change the welcome text, select a parish photograph, and add, edit or remove weekly service times. The same editor manages parish history paragraphs, sacramental service listings, ministries, office address, hours and an optional public email. Contact now opens real map, calendar and email destinations. The old contact form only simulated a successful submission. Publishing updates the homepage, Services page and member calendar on their next page load. Removing a service from the draft does not change the site until publication. Two editors working from the same revision receive a conflict rather than losing a published change.

On a disposable PostgreSQL clone, apply deploy/migrations/20261121_site_edition.sql with the existing migration role. The trusted Next database connection needs SELECT and INSERT on parish_private.site_edition through its existing private role model. Verify this role before enabling editing. Set PARISH_SITE_EDITOR=enabled on the Next service and use the existing PARISH_SUPER_ADMIN_ID for the designated ADMIN. No credentials belong in Git. The static schedule continues serving while editing is disabled. If the enabled content store fails, the public page omits unverified times until recovery.

Staff can edit an existing announcement at Main Admin → Announcements → Edit → Save changes. The existing announcement scheduling flags and migration are required for dated public notices. Deleting archive records and reviewing financial information continue to follow existing office restrictions.

## Acceptance and rollback

Test an edited Sunday service on the signed-out homepage and Services page, and under Calendar and notices as a parishioner. Test removal of the last service, two concurrent editors, denied writes from a parishioner, and editing an existing dated notice. Test office navigation with keyboard, phone and desktop.

Use a backed-up staging environment for rollout. Apply the additive migration first. Deploy compatible web and API revisions together before enabling the setting. Disable PARISH_SITE_EDITOR to restore bundled homepage content and use the prior application revision for a UI rollback. Retain all published editions and audit rows.
