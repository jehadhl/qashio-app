export const ACCESS_TOKEN_COOKIE = 'token';
export const REFRESH_TOKEN_COOKIE = 'refreshToken';
// Set when the user ticks "Remember me"; without it the auth cookies are session
// cookies that go away when the browser closes. The refresh route reads it to keep
// the same behaviour for the new token pair.
export const REMEMBER_ME_COOKIE = 'rememberMe';
