import { createRootRoute, Outlet, createFileRoute, lazyRouteComponent, createRouter as createRouter$1 } from "@tanstack/react-router";
import { jsxs, jsx } from "react/jsx-runtime";
const Route$1 = createRootRoute({
  component: () => /* @__PURE__ */ jsxs("html", { children: [
    /* @__PURE__ */ jsxs("head", { children: [
      /* @__PURE__ */ jsx("meta", { charSet: "utf-8" }),
      /* @__PURE__ */ jsx("meta", { name: "viewport", content: "width=device-width, initial-scale=1" }),
      /* @__PURE__ */ jsx("title", { children: "Storefront" })
    ] }),
    /* @__PURE__ */ jsx("body", { children: /* @__PURE__ */ jsx(Outlet, {}) })
  ] })
});
const $$splitComponentImporter = () => import("./index-Fun0IK_I.js");
const Route = createFileRoute("/")({
  component: lazyRouteComponent($$splitComponentImporter, "component")
});
const IndexRoute = Route.update({
  id: "/",
  path: "/",
  getParentRoute: () => Route$1
});
const rootRouteChildren = {
  IndexRoute
};
const routeTree = Route$1._addFileChildren(rootRouteChildren)._addFileTypes();
function createRouter() {
  return createRouter$1({ routeTree });
}
const getRouter = createRouter;
export {
  createRouter,
  getRouter
};
