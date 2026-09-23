import { createRootRoute, createRoute, createRouter, Outlet } from "@tanstack/react-router";
import { GameBoard } from "./features/vilkarsbingo/components/game-board";
import { AvslagBoard } from "./features/avslagsgeneratoren/components/avslag-board";

const rootRoute = createRootRoute({
  component: Outlet,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: GameBoard,
});

const avslagRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/avslag",
  component: AvslagBoard,
});

const routeTree = rootRoute.addChildren([indexRoute, avslagRoute]);

export const router = createRouter({ routeTree, defaultPreload: "intent" });
