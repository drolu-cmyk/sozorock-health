import { BrandLockup } from "./components/BrandLockup";

export default function NotFound() {
  return (
    <main className="error-screen">
      <BrandLockup />
      <p>404</p>
      <h1>This CB-CAP view does not exist.</h1>
      <p>Return to the nationwide county intelligence workspace.</p>
      <a href="/">Return to CB-CAP</a>
    </main>
  );
}
