import NextAuth from "next-auth";
import { authConfig } from "./app/(auth)/auth.config";

export const { auth: middleware } = NextAuth(authConfig);

export default middleware((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const isAdminRoute = nextUrl.pathname.startsWith("/admin");

  if (isAdminRoute) {
    if (!isLoggedIn) {
      return Response.redirect(new URL("/login", nextUrl));
    }
    
    // Case-insensitive email check
    const userEmail = req.auth?.user?.email?.toLowerCase();
    if (userEmail !== "pevznergo@gmail.com") {
       // Redirect to home with error, or custom 403 page
       // Adding a query param helps debugging
       return Response.redirect(new URL("/?error=access_denied&from_middleware=true", nextUrl));
    }
  }
});

export const config = {
  // Matched paths for middleware
  matcher: ["/admin/:path*"],
};
