import { ThemeProvider } from "../theme";
import { TokenShowcase } from "../pages/TokenShowcase";

export function App() {
  return (
    <ThemeProvider>
      <TokenShowcase />
    </ThemeProvider>
  );
}
