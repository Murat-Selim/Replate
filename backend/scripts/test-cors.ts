import assert from "node:assert/strict";
import { isAllowedFrontendOrigin } from "../server/config.js";

const configured = ["https://replate-webapp.vercel.app", "http://localhost:3000"];

assert.equal(isAllowedFrontendOrigin("https://replate-webapp.vercel.app", configured), true);
assert.equal(isAllowedFrontendOrigin("https://replate-farcaster-git-main-example.vercel.app", configured), true);
assert.equal(isAllowedFrontendOrigin("https://unrelated-project.vercel.app", configured), false);

console.log("CORS checks passed");
