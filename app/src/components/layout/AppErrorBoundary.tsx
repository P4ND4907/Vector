import React, { type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  error: Error | null;
}

export class AppErrorBoundary extends React.Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = {
    error: null
  };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  handleReset = () => {
    window.localStorage.removeItem("vector-control-hub-store");
    window.location.reload();
  };

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-10">
        <Card className="w-full max-w-xl">
          <CardHeader>
            <div className="eyebrow">Recovery mode</div>
            <CardTitle className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Vector Control Hub hit a startup error
            </CardTitle>
            <CardDescription>
              This usually means saved local app data no longer matches the current app version.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-muted-foreground">
              <div className="font-semibold text-foreground">Error</div>
              <div className="mt-2 break-words">{this.state.error.message}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={this.handleReset}>
                <RefreshCw className="h-4 w-4" />
                Reset local app data
              </Button>
              <Button variant="outline" onClick={() => window.location.reload()}>
                Try again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
}

