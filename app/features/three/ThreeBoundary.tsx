// Catches a 3D scene that fails to start (no WebGL context after all, a driver error) and shows the 2D version instead,
// like the old kit's try/catch around createKit. No three.js here, so it can wrap a lazy scene.
import { Component, type ReactNode } from "react";

interface Props {
  fallback: ReactNode;
  onError?: (error: unknown) => void;
  children: ReactNode;
}

export class ThreeBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.warn("3D unavailable, using 2D", error);
    this.props.onError?.(error);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
