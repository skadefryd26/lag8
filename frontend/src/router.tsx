import { createRootRoute, createRoute, createRouter, Outlet } from "@tanstack/react-router";
import { GameBoard } from "./features/vilkarsbingo/components/game-board";

const rootRoute = createRootRoute({
  component: Outlet,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: GameBoard,
});

const routeTree = rootRoute.addChildren([indexRoute]);

export const router = createRouter({ routeTree, defaultPreload: "intent" });
