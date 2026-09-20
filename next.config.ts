import type {NextConfig} from "next";

const config:NextConfig={
  // Public /web routes are served by this application directly.
  // Keeping them local avoids cross-project rewrite loops in the monorepo.
};

export default config;
