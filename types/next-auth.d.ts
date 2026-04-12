import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    backendToken?: string;
  }

  interface User {
    backendToken?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    backendToken?: string;
  }
}
