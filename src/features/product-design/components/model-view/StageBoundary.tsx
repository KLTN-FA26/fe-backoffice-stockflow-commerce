"use client";

import { Component } from "react";

import type { ReactNode } from "react";

/** A scene that cannot start (a driver that refuses the context) shows `fallback` instead of taking the screen down. */
export class StageBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
