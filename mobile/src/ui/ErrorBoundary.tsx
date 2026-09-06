// Catches render-time crashes. Release builds have no red-box overlay, so
// without this an uncaught error leaves the user staring at a blank screen.

import React from "react";
import { ScrollView } from "react-native";
import { Txt } from "./Text";
import { Button } from "./Button";
import { Card } from "./Card";
import { spacing, useTheme } from "./theme";

function Fallback({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const { colors } = useTheme();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: spacing.xl, gap: spacing.lg }}
    >
      <Txt variant="title">Something broke</Txt>
      <Txt variant="muted">
        The app hit an unexpected error. Your downloaded receipts are safe on this device.
      </Txt>
      <Card>
        <Txt variant="caption">{error.message}</Txt>
      </Card>
      <Button title="Try again" icon="refresh" onPress={onRetry} />
    </ScrollView>
  );
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return <Fallback error={error} onRetry={() => this.setState({ error: null })} />;
  }
}
