import { NextResponse, type NextRequest } from "next/server"

const AUTH_COOKIE = "cloner_access"

function isProtected(pathname: string) {
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/models") ||
    pathname.startsWith("/api/auth") ||
    pathname === "/login"
  ) {
    return false
  }
  return true
}

export function proxy(request: NextRequest) {
  const password = process.env.CLONER_ACCESS_PASSWORD
  if (!password || !isProtected(request.nextUrl.pathname)) {
    return NextResponse.next()
  }

  const cookie = request.cookies.get(AUTH_COOKIE)?.value
  if (cookie === password) {
    return NextResponse.next()
  }

  const loginUrl = request.nextUrl.clone()
  loginUrl.pathname = "/login"
  loginUrl.searchParams.set("next", request.nextUrl.pathname)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\..*).*)"],
}
