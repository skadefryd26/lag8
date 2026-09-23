import { createRootRoute, createRoute, createRouter, Outlet } from "@tanstack/react-router";
import { GameBoard } from "./features/vilkarsbingo/components/game-board";
import { AvslagBoard } from "./features/avslagsgeneratoren/components/avslag-board";
import { Avslagsgenerator } from "./features/avslagsgenerator/avslagsgenerator";

const rootRoute = createRootRoute({
  component: Outlet,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: Avslagsgenerator,
});

const oracleRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/skadeorakelet",
  component: GameBoard,
});

const avslagRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/avslag",
  component: AvslagBoard,
});

const routeTree = rootRoute.addChildren([indexRoute, avslagRoute, oracleRoute]);

export const router = createRouter({ routeTree, defaultPreload: "intent" });
