import { createRootRoute, createRoute, createRouter, Outlet } from "@tanstack/react-router";
import { GameBoard } from "./features/vilkarsbingo/components/game-board";
import { Avslagsgenerator } from "./features/avslagsgenerator/avslagsgenerator";
import { AiShowcase } from "./features/ai-showcase/ai-showcase";

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

const showcaseRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/ai-mot-ai",
  component: AiShowcase,
});

const routeTree = rootRoute.addChildren([indexRoute, oracleRoute, showcaseRoute]);

export const router = createRouter({ routeTree, defaultPreload: "intent" });
