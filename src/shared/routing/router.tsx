import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface RouterContextValue {
  hash: string;
  navigate: (path: string, opts?: { replace?: boolean }) => void;
}

const RouterContext = createContext<RouterContextValue | null>(null);

function readHash(): string {
  if (typeof window === "undefined") return "/";
  const h = window.location.hash;
  if (!h || h === "#") return "/";
  // Strip leading "#"
  return h.startsWith("#") ? h.slice(1) : h;
}

export function HashRouter({ children }: { children: ReactNode }) {
  const [hash, setHash] = useState<string>(() => readHash());

  useEffect(() => {
    const onChange = () => setHash(readHash());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  const navigate = useCallback((path: string, opts?: { replace?: boolean }) => {
    const next = path.startsWith("/") ? path : `/${path}`;
    const target = `#${next}`;
    if (opts?.replace) {
      const url = `${window.location.pathname}${window.location.search}${target}`;
      window.history.replaceState(null, "", url);
      // replaceState doesn't fire hashchange — push manually.
      setHash(next);
    } else {
      window.location.hash = target;
    }
  }, []);

  const value = useMemo<RouterContextValue>(() => ({ hash, navigate }), [hash, navigate]);

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

function useRouter(): RouterContextValue {
  const ctx = useContext(RouterContext);
  if (!ctx) throw new Error("useRouter must be used within HashRouter");
  return ctx;
}

export function useNavigate(): (path: string, opts?: { replace?: boolean }) => void {
  return useRouter().navigate;
}

export function useLocation(): { pathname: string } {
  return { pathname: useRouter().hash };
}

interface RouteMatch {
  path: string;
  params: Record<string, string>;
}

function matchRoute(pattern: string, pathname: string): RouteMatch | null {
  const patternParts = pattern.split("/").filter(Boolean);
  const pathParts = pathname.split("/").filter(Boolean);
  if (patternParts.length !== pathParts.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i++) {
    const pp = patternParts[i]!;
    const ap = pathParts[i]!;
    if (pp.startsWith(":")) {
      params[pp.slice(1)] = decodeURIComponent(ap);
    } else if (pp !== ap) {
      return null;
    }
  }
  return { path: pattern, params };
}

interface RouteProps {
  path: string;
  element: ReactNode | ((params: Record<string, string>) => ReactNode);
}

const ParamsContext = createContext<Record<string, string>>({});

export function useParams<T extends Record<string, string> = Record<string, string>>(): T {
  return useContext(ParamsContext) as T;
}

export function Route({ path, element }: RouteProps) {
  const { hash } = useRouter();
  const m = matchRoute(path, hash);
  if (!m) return null;
  const node = typeof element === "function" ? element(m.params) : element;
  return <ParamsContext.Provider value={m.params}>{node}</ParamsContext.Provider>;
}

export function Routes({ children }: { children: ReactNode }) {
  // Render the first matching route; fall back to last child if none match.
  const { hash } = useRouter();
  const childArray = Array.isArray(children) ? children : [children];
  for (const child of childArray) {
    if (
      child &&
      typeof child === "object" &&
      "props" in child &&
      typeof (child as { props: unknown }).props === "object" &&
      (child as { props: { path?: string } }).props.path
    ) {
      const c = child as { props: RouteProps };
      if (matchRoute(c.props.path, hash)) return <>{child}</>;
    }
  }
  return null;
}
