import { httpRouter } from "convex/server";

const http = httpRouter();

// The authz component doesn't expose HTTP routes by default
// You can add custom HTTP routes here if needed

export default http;
