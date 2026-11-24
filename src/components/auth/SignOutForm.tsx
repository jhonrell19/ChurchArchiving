/**
 * Logout is a real browser navigation, not a fetch() that follows a 303.
 * The server revokes the session, expires cookies, and redirects to login.
 * No JS/client state is needed for security.
 */
export default function SignOutForm({className='role-signout w-full'}:{className?:string}){
  return <form method="post" action="/api/auth/logout">
    <button type="submit" className={className}>
      <i className="ti ti-logout" aria-hidden="true"/> Sign out
    </button>
  </form>
}
