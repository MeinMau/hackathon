"use client";

import {
  CSSProperties,
  FormEvent,
  PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Image from "next/image";
import styles from "./ScreenOS.module.css";

type AppId = "cmd" | "notes" | "browser";
type WindowMode = "floating" | "maximized" | "minimized";

type Bounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type AppDefinition = {
  id: AppId;
  title: string;
  desktopLabel: string;
  iconSrc: string;
  defaultBounds: Bounds;
};

type OSWindow = Bounds & {
  id: string;
  appId: AppId;
  title: string;
  mode: WindowMode;
  previousBounds?: Bounds;
  zIndex: number;
};

type PointerOperation =
  | {
      type: "move";
      id: string;
      startX: number;
      startY: number;
      bounds: Bounds;
    }
  | {
      type: "resize";
      id: string;
      startX: number;
      startY: number;
      bounds: Bounds;
    };

export type ScreenOSProps = {
  className?: string;
  interactive?: boolean;
  defaultOpenApps?: AppId[];
  style?: CSSProperties;
};

const APPS: Record<AppId, AppDefinition> = {
  cmd: {
    id: "cmd",
    title: "CMD",
    desktopLabel: "CMD",
    iconSrc: "/favicon.svg",
    defaultBounds: { x: 88, y: 58, width: 640, height: 390 },
  },
  notes: {
    id: "notes",
    title: "Notas",
    desktopLabel: "Notas",
    iconSrc: "/file.svg",
    defaultBounds: { x: 74, y: 68, width: 540, height: 360 },
  },
  browser: {
    id: "browser",
    title: "Navegador",
    desktopLabel: "Navegador",
    iconSrc: "/window.svg",
    defaultBounds: { x: 142, y: 44, width: 720, height: 430 },
  },
};

const DESKTOP_APPS: AppDefinition[] = [APPS.cmd, APPS.notes, APPS.browser];
const DEFAULT_OPEN_APPS: AppId[] = ["cmd"];
const MIN_WINDOW_WIDTH = 260;
const MIN_WINDOW_HEIGHT = 190;
const NOTES_STORAGE_KEY = "hackathon-screen-os-notes";
const DEFAULT_NOTE = `HACKATHON ISND / INGENIA
--------------------------------
Agenda rapida del equipo:

- Definir problema y usuario.
- Bocetar una solucion sencilla.
- Construir prototipo navegable.
- Preparar demo con impacto de negocio.

Ideas sueltas:
`;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function isControlTarget(target: EventTarget | null) {
  return target instanceof HTMLElement
    ? Boolean(target.closest("button, input, textarea, select, a, [role='button']"))
    : false;
}

function ScreenIcon({ src, alt }: { src: string; alt: string }) {
  return (
    <span className={styles.appIconShell}>
      <Image src={src} alt={alt} width={22} height={22} draggable={false} unoptimized />
    </span>
  );
}

function NotesApp() {
  const [note, setNote] = useState(DEFAULT_NOTE);
  const [status, setStatus] = useState("Auto guardado activo");
  const canPersistRef = useRef(false);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      try {
        const saved = window.localStorage.getItem(NOTES_STORAGE_KEY);
        if (saved) {
          setNote(saved);
        }
      } catch {
        setStatus("Sesion local");
      } finally {
        canPersistRef.current = true;
      }
    });

    return () => window.cancelAnimationFrame(frameId);
  }, []);

  useEffect(() => {
    if (!canPersistRef.current) {
      return;
    }

    try {
      window.localStorage.setItem(NOTES_STORAGE_KEY, note);
    } catch {
      // Local storage can be unavailable in restricted browser contexts.
    }
  }, [note]);

  const lineCount = note.split(/\r\n|\r|\n/).length;
  const wordCount = note.trim() ? note.trim().split(/\s+/).length : 0;

  return (
    <div className={styles.notesApp}>
      <div className={styles.notesMenu} aria-label="Notas acciones">
        <button type="button" onClick={() => setNote("")}>
          Nuevo
        </button>
        <button
          type="button"
          onClick={() => {
            setNote(DEFAULT_NOTE);
            setStatus("Plantilla restaurada");
          }}
        >
          Plantilla
        </button>
        <button
          type="button"
          onClick={() => setStatus(`Guardado ${new Date().toLocaleTimeString("es-MX")}`)}
        >
          Guardar
        </button>
      </div>
      <textarea
        className={styles.notesText}
        value={note}
        spellCheck={false}
        onChange={(event) => {
          setNote(event.target.value);
          setStatus("Editando");
        }}
        aria-label="Editor de notas"
      />
      <div className={styles.appStatus}>
        <span>{status}</span>
        <span>
          {lineCount} lineas / {wordCount} palabras
        </span>
      </div>
    </div>
  );
}

type CmdAppProps = {
  onOpenApp: (appId: AppId) => void;
};

const CMD_INTRO = [
  `               +@@-
               .
          -#:  %%% .@@##@@@@#  =*:
      :#@@@%   +@@:.@@@-  @@@   @@@*.
    @@@@       +@@:.@@@   +@@      -@@@@
    .#@@@*     +@@:.@@@   +@@    #@@@*
        =%@@   +@@:.@@@   +@@  @@#`,
  "",
  "Hackathon ISND [v06/08/26]",
  "Ingeniería de Software y Desarrollo de Negocios, IEST Anahuac.",
];

const HACKATHON_INFO_COMMANDS = new Set(["hackaton", "hackathon", "info", "informacion"]);

const HACKATHON_INFO = [
  "     _       _                 INFORMACION GENERAL",
  "  __| |__   (_) _ __           Hackathon ISND - INGENIA \"<in>hack>\"",
  " / _  '_ \\  | || '_ \\          IEST Anahuac",
  "| (_| | | | | || | | |         Sistemas y Negocios Digitales",
  " \\__,_| |_| |_||_| |_|         Primer Concurso de Programacion",
  "",
  "La carrera de Ingenieria en Sistemas y Negocios Digitales (ISND) y la",
  "Sociedad de Alumnos de Ingenieria en Sistemas y Negocios Digitales",
  "(INGENIA) del IEST Anahuac invitan a estudiantes de preparatoria y",
  "universidad a formar parte de este espacio para desarrollar pensamiento",
  "logico, resolucion de problemas y trabajo colaborativo a traves del codigo.",
  "",
  "[FECHAS]",
  "  3 y 4 de septiembre | 8:00 AM - 7:00 PM",
  "",
  "[CATEGORIAS]",
  "  - Preparatoria",
  "  - Hackathon (Profesional)",
  "",
  "[COLABORADORES]",
  "  Sunshine Snacks    Mini Joy          Nutriviva",
  "  Lunar accesorios   Pixi Planet       Aura Maquillaje",
  "  Veintitres Joyeria Blu Coffee        Pokeburrito",
  "  La marquesita",
  "",
  "[REGISTRO]",
  "  https://forms.gle/XsfQJUWYxTgDEEDWA",
];

function CmdApp({ onOpenApp }: CmdAppProps) {
  const [output, setOutput] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    contentRef.current?.scrollTo({
      top: contentRef.current.scrollHeight,
    });
  }, [output]);

  function resolveCommand(rawCommand: string) {
    const command = rawCommand.trim();
    const normalizedCommand = command
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    const commandTokens = normalizedCommand.match(/[a-z0-9]+/g) ?? [];

    if (!command) {
      return [];
    }

    if (commandTokens.some((token) => HACKATHON_INFO_COMMANDS.has(token))) {
      return HACKATHON_INFO;
    }

    if (normalizedCommand === "clear" || normalizedCommand === "cls") {
      setOutput([]);
      return [];
    }

    if (normalizedCommand === "help") {
      return [
        "Comandos disponibles:",
        "help, about, clear, cls, dir, date, time, lp",
        "hackaton, hackathon, info, informacion",
        "open notas, open navegador, open cmd",
      ];
    }

    if (normalizedCommand === "about") {
      return [
        "Hackathon ISND [v06/08/26]",
        "Ingeniería de Software y Desarrollo de Negocios, IEST Anahuac.",
        "Ingenia OS listo para demo interactiva.",
      ];
    }

    if (normalizedCommand === "dir" || normalizedCommand === "ls") {
      return [
        "Directorio de C:/hackathon",
        "  <APP> CMD",
        "  <APP> Notas",
        "  <APP> Navegador",
        "  <SYS> taskbar.window-manager",
      ];
    }

    if (normalizedCommand === "date") {
      return [new Intl.DateTimeFormat("es-MX", { dateStyle: "full" }).format(new Date())];
    }

    if (normalizedCommand === "time") {
      return [new Intl.DateTimeFormat("es-MX", { timeStyle: "medium" }).format(new Date())];
    }

    if (normalizedCommand === "lp") {
      return [
        "Landing protocol: armado.",
        "Scroll hook pendiente: laptop cerrada -> pantalla abierta -> ScreenOS interactivo.",
      ];
    }

    if (normalizedCommand === "open notas" || normalizedCommand === "notas") {
      onOpenApp("notes");
      return ["Abriendo Notas..."];
    }

    if (
      normalizedCommand === "open navegador" ||
      normalizedCommand === "navegador" ||
      normalizedCommand === "browser"
    ) {
      onOpenApp("browser");
      return ["Abriendo Navegador..."];
    }

    if (normalizedCommand === "open cmd" || normalizedCommand === "cmd") {
      onOpenApp("cmd");
      return ["Abriendo nueva instancia de CMD..."];
    }

    if (normalizedCommand.startsWith("echo ")) {
      return [command.slice(5)];
    }

    return [
      `${command} no se reconoce como un comando interno o externo,`,
      "programa o archivo por lotes ejecutable.",
    ];
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const command = inputValue.trim();
    if (!command) {
      requestAnimationFrame(() => inputRef.current?.focus());
      return;
    }

    const response = resolveCommand(command);
    if (command.toLowerCase() !== "clear" && command.toLowerCase() !== "cls") {
      setOutput((currentOutput) => [...currentOutput, `C:/hackathon>${command}`, ...response, ""]);
    }

    setInputValue("");
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  return (
    <div className={styles.cmdApp} onPointerDown={() => inputRef.current?.focus()}>
      <div className={styles.cmdContent} ref={contentRef}>
        {CMD_INTRO.map((line, index) => (
          <div key={`intro-${index}`} className={styles.cmdLine}>
            {line}
          </div>
        ))}

        {output.map((line, index) => (
          <div key={`output-${index}`} className={styles.cmdLine}>
            {line}
          </div>
        ))}

        <form className={styles.cmdInputLine} onSubmit={handleSubmit}>
          <span>C:/hackathon&gt;</span>
          <input
            ref={inputRef}
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            aria-label="Comando"
            autoCapitalize="off"
            autoComplete="off"
            spellCheck={false}
          />
        </form>
      </div>
    </div>
  );
}

type BrowserTab = {
  id: number;
  title: string;
  url: string;
  history: string[];
  historyIndex: number;
};

const HOME_URL = "hackathon://home";
const REGISTRATION_URL = "https://forms.gle/XsfQJUWYxTgDEEDWA";

function normalizeBrowserUrl(value: string) {
  const url = value.trim();

  if (!url) {
    return HOME_URL;
  }

  if (url.startsWith("hackathon://") || url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  if (url.includes(".")) {
    return `https://${url}`;
  }

  return `hackathon://search/${encodeURIComponent(url)}`;
}

function titleFromUrl(url: string) {
  if (url === HOME_URL) {
    return "Hackathon Home";
  }

  if (url.startsWith("hackathon://search/")) {
    return "Busqueda";
  }

  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function BrowserPage({ url, onNavigate }: { url: string; onNavigate: (url: string) => void }) {
  if (url === HOME_URL) {
    return (
      <div className={styles.browserHome}>
        <div className={styles.browserHero}>
          <Image src="/favicon.svg" alt="" width={54} height={54} draggable={false} unoptimized />
          <div>
            <span>INGENIA OS</span>
            <h3>Hackathon Command Center</h3>
          </div>
        </div>

        <div className={styles.browserShortcutGrid}>
          <button type="button" onClick={() => onNavigate(REGISTRATION_URL)}>
            Registro
          </button>
          <button type="button" onClick={() => onNavigate("hackathon://brief")}>
            Brief
          </button>
          <button type="button" onClick={() => onNavigate("hackathon://agenda")}>
            Agenda
          </button>
        </div>

        <div className={styles.browserArticle}>
          <span>03 SEPT 2026</span>
          <h4>Crea, imagina, ingenia</h4>
          <p>
            Un espacio para convertir retos de negocio en prototipos claros,
            funcionales y listos para demo.
          </p>
        </div>
      </div>
    );
  }

  if (url === "hackathon://brief") {
    return (
      <div className={styles.browserDocument}>
        <span>BRIEF</span>
        <h3>Reto del hackathon</h3>
        <p>
          Identifica un problema real, define usuario objetivo y muestra una
          solucion que pueda entenderse en una demo corta.
        </p>
        <ul>
          <li>Impacto de negocio</li>
          <li>Prototipo funcional</li>
          <li>Narrativa clara</li>
        </ul>
      </div>
    );
  }

  if (url === "hackathon://agenda") {
    return (
      <div className={styles.browserDocument}>
        <span>AGENDA</span>
        <h3>Ruta sugerida</h3>
        <p>Explorar, construir, validar y presentar con una historia compacta.</p>
        <ol>
          <li>Descubrimiento del problema</li>
          <li>Diseno del flujo principal</li>
          <li>Construccion del prototipo</li>
          <li>Preparacion de demo</li>
        </ol>
      </div>
    );
  }

  if (url.startsWith("hackathon://search/")) {
    const query = decodeURIComponent(url.replace("hackathon://search/", ""));

    return (
      <div className={styles.browserDocument}>
        <span>BUSQUEDA LOCAL</span>
        <h3>{query}</h3>
        <p>
          Resultados dentro del entorno ScreenOS. Prueba con brief, agenda o
          una URL completa.
        </p>
        <button type="button" onClick={() => onNavigate("hackathon://brief")}>
          Abrir brief
        </button>
      </div>
    );
  }

  return (
    <div className={styles.browserDocument}>
      <span>WEB PREVIEW</span>
      <h3>{titleFromUrl(url)}</h3>
      <p>
        Esta vista mantiene la navegacion dentro de ScreenOS y deja la pagina
        real disponible en una pestana externa.
      </p>
      <a href={url} target="_blank" rel="noreferrer">
        Abrir pagina real
      </a>
    </div>
  );
}

function BrowserApp() {
  const [tabs, setTabs] = useState<BrowserTab[]>([
    {
      id: 1,
      title: "Hackathon Home",
      url: HOME_URL,
      history: [HOME_URL],
      historyIndex: 0,
    },
  ]);
  const [activeTabId, setActiveTabId] = useState(1);
  const [address, setAddress] = useState(HOME_URL);
  const tabCounterRef = useRef(1);

  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];
  const canGoBack = activeTab.historyIndex > 0;
  const canGoForward = activeTab.historyIndex < activeTab.history.length - 1;

  const updateActiveTab = useCallback((updater: (tab: BrowserTab) => BrowserTab) => {
    setTabs((currentTabs) =>
      currentTabs.map((tab) => (tab.id === activeTabId ? updater(tab) : tab)),
    );
  }, [activeTabId]);

  const navigate = useCallback(
    (target: string) => {
      const nextUrl = normalizeBrowserUrl(target);
      setAddress(nextUrl);
      updateActiveTab((tab) => {
        const history = tab.history.slice(0, tab.historyIndex + 1);
        history.push(nextUrl);

        return {
          ...tab,
          url: nextUrl,
          title: titleFromUrl(nextUrl),
          history,
          historyIndex: history.length - 1,
        };
      });
    },
    [updateActiveTab],
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigate(address);
  }

  function createTab() {
    tabCounterRef.current += 1;
    const id = tabCounterRef.current;
    const newTab: BrowserTab = {
      id,
      title: "Nueva pestana",
      url: HOME_URL,
      history: [HOME_URL],
      historyIndex: 0,
    };

    setTabs((currentTabs) => [...currentTabs, newTab]);
    setActiveTabId(id);
    setAddress(HOME_URL);
  }

  function closeTab(tabId: number) {
    if (tabs.length === 1) {
      return;
    }

    const nextTabs = tabs.filter((tab) => tab.id !== tabId);
    if (tabId === activeTabId) {
      setActiveTabId(nextTabs[0].id);
      setAddress(nextTabs[0].url);
    }

    setTabs(nextTabs);
  }

  function travel(direction: "back" | "forward") {
    const nextIndex = direction === "back" ? activeTab.historyIndex - 1 : activeTab.historyIndex + 1;
    const safeIndex = clamp(nextIndex, 0, activeTab.history.length - 1);
    const nextUrl = activeTab.history[safeIndex];

    setAddress(nextUrl);
    updateActiveTab((tab) => {
      return {
        ...tab,
        url: nextUrl,
        title: titleFromUrl(nextUrl),
        historyIndex: safeIndex,
      };
    });
  }

  return (
    <div className={styles.browserApp}>
      <form className={styles.browserToolbar} onSubmit={handleSubmit}>
        <button type="button" disabled={!canGoBack} onClick={() => travel("back")} title="Atras">
          {"<"}
        </button>
        <button
          type="button"
          disabled={!canGoForward}
          onClick={() => travel("forward")}
          title="Adelante"
        >
          {">"}
        </button>
        <button type="button" onClick={() => navigate(activeTab.url)} title="Recargar">
          R
        </button>
        <input
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          aria-label="Direccion del navegador"
        />
        <button type="submit">IR</button>
      </form>

      <div className={styles.tabsBar} role="tablist" aria-label="Pestanas del navegador">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={tab.id === activeTabId}
            className={tab.id === activeTabId ? styles.activeTab : undefined}
            onClick={() => {
              setActiveTabId(tab.id);
              setAddress(tab.url);
            }}
          >
            <span>{tab.title}</span>
            <span
              role="button"
              tabIndex={-1}
              onClick={(event) => {
                event.stopPropagation();
                closeTab(tab.id);
              }}
            >
              x
            </span>
          </button>
        ))}
        <button type="button" className={styles.newTabButton} onClick={createTab} title="Nueva pestana">
          +
        </button>
      </div>

      <div className={styles.browserViewport}>
        <BrowserPage url={activeTab.url} onNavigate={navigate} />
      </div>

      <div className={styles.appStatus}>
        <span>Listo</span>
        <span>{activeTab.url}</span>
      </div>
    </div>
  );
}

function WindowContent({ appId, onOpenApp }: { appId: AppId; onOpenApp: (appId: AppId) => void }) {
  if (appId === "cmd") {
    return <CmdApp onOpenApp={onOpenApp} />;
  }

  if (appId === "notes") {
    return <NotesApp />;
  }

  return <BrowserApp />;
}

export default function ScreenOS({
  className = "",
  interactive = true,
  defaultOpenApps = DEFAULT_OPEN_APPS,
  style,
}: ScreenOSProps) {
  const [windows, setWindows] = useState<OSWindow[]>([]);
  const [recentApps, setRecentApps] = useState<AppId[]>([]);
  const [activeWindowId, setActiveWindowId] = useState<string | null>(null);
  const [startMenuOpen, setStartMenuOpen] = useState(false);
  const [clock, setClock] = useState("");

  const desktopRef = useRef<HTMLDivElement | null>(null);
  const startButtonRef = useRef<HTMLButtonElement | null>(null);
  const startMenuRef = useRef<HTMLDivElement | null>(null);
  const pointerOperationRef = useRef<PointerOperation | null>(null);
  const zIndexRef = useRef(10);
  const windowCounterRef = useRef(0);
  const didOpenDefaultsRef = useRef(false);

  const rootClassName = `${styles.root} ${interactive ? "" : styles.nonInteractive} ${className}`.trim();

  const getDesktopSize = useCallback(() => {
    const desktop = desktopRef.current;
    return {
      width: desktop?.clientWidth ?? 960,
      height: desktop?.clientHeight ?? 540,
    };
  }, []);

  const getInitialBounds = useCallback(
    (appId: AppId, openWindowCount = 0) => {
      const app = APPS[appId];
      const desktop = getDesktopSize();
      const cascade = openWindowCount * 24;
      const width = Math.min(app.defaultBounds.width, Math.max(MIN_WINDOW_WIDTH, desktop.width - 28));
      const height = Math.min(app.defaultBounds.height, Math.max(MIN_WINDOW_HEIGHT, desktop.height - 28));
      const maxX = Math.max(8, desktop.width - width - 8);
      const maxY = Math.max(8, desktop.height - height - 8);

      return {
        width,
        height,
        x: clamp(app.defaultBounds.x + cascade, 8, maxX),
        y: clamp(app.defaultBounds.y + cascade, 8, maxY),
      };
    },
    [getDesktopSize],
  );

  const addToRecentApps = useCallback((appId: AppId) => {
    setRecentApps((currentApps) => [appId, ...currentApps.filter((id) => id !== appId)].slice(0, 5));
  }, []);

  const bringToFront = useCallback((id: string) => {
    zIndexRef.current += 1;
    setActiveWindowId(id);
    setWindows((currentWindows) =>
      currentWindows.map((windowState) =>
        windowState.id === id ? { ...windowState, zIndex: zIndexRef.current } : windowState,
      ),
    );
  }, []);

  const openApp = useCallback(
    (appId: AppId) => {
      addToRecentApps(appId);
      setStartMenuOpen(false);
      zIndexRef.current += 1;
      windowCounterRef.current += 1;

      const app = APPS[appId];
      const windowId = `${appId}-${windowCounterRef.current}`;
      const zIndex = zIndexRef.current;
      setActiveWindowId(windowId);

      setWindows((currentWindows) => {
        const bounds = getInitialBounds(appId, currentWindows.length);

        return [
          ...currentWindows,
          {
            id: windowId,
            appId,
            title: app.title,
            mode: "floating",
            zIndex,
            ...bounds,
          },
        ];
      });
    },
    [addToRecentApps, getInitialBounds],
  );

  useEffect(() => {
    if (didOpenDefaultsRef.current) {
      return;
    }

    didOpenDefaultsRef.current = true;
    defaultOpenApps.forEach((appId) => openApp(appId));
  }, [defaultOpenApps, openApp]);

  useEffect(() => {
    const updateClock = () => {
      setClock(
        new Intl.DateTimeFormat("es-MX", {
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date()),
      );
    };

    updateClock();
    const intervalId = window.setInterval(updateClock, 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const operation = pointerOperationRef.current;
      if (!operation) {
        return;
      }

      const desktop = desktopRef.current;
      const desktopWidth = desktop?.clientWidth ?? 960;
      const desktopHeight = desktop?.clientHeight ?? 540;
      const deltaX = event.clientX - operation.startX;
      const deltaY = event.clientY - operation.startY;

      setWindows((currentWindows) =>
        currentWindows.map((windowState) => {
          if (windowState.id !== operation.id || windowState.mode !== "floating") {
            return windowState;
          }

          if (operation.type === "move") {
            const maxX = Math.max(0, desktopWidth - windowState.width);
            const maxY = Math.max(0, desktopHeight - 36);

            return {
              ...windowState,
              x: clamp(operation.bounds.x + deltaX, 0, maxX),
              y: clamp(operation.bounds.y + deltaY, 0, maxY),
            };
          }

          const width = clamp(operation.bounds.width + deltaX, MIN_WINDOW_WIDTH, desktopWidth - windowState.x);
          const height = clamp(operation.bounds.height + deltaY, MIN_WINDOW_HEIGHT, desktopHeight - windowState.y);

          return {
            ...windowState,
            width,
            height,
          };
        }),
      );
    };

    const stopOperation = () => {
      pointerOperationRef.current = null;
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopOperation);
    window.addEventListener("pointercancel", stopOperation);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopOperation);
      window.removeEventListener("pointercancel", stopOperation);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setStartMenuOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  function beginMove(event: ReactPointerEvent<HTMLDivElement>, windowState: OSWindow) {
    if (!interactive || windowState.mode !== "floating" || event.button !== 0 || isControlTarget(event.target)) {
      return;
    }

    event.preventDefault();
    bringToFront(windowState.id);
    pointerOperationRef.current = {
      type: "move",
      id: windowState.id,
      startX: event.clientX,
      startY: event.clientY,
      bounds: {
        x: windowState.x,
        y: windowState.y,
        width: windowState.width,
        height: windowState.height,
      },
    };
  }

  function beginResize(event: ReactPointerEvent<HTMLDivElement>, windowState: OSWindow) {
    if (!interactive || windowState.mode !== "floating") {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    bringToFront(windowState.id);
    pointerOperationRef.current = {
      type: "resize",
      id: windowState.id,
      startX: event.clientX,
      startY: event.clientY,
      bounds: {
        x: windowState.x,
        y: windowState.y,
        width: windowState.width,
        height: windowState.height,
      },
    };
  }

  function closeWindow(id: string) {
    setWindows((currentWindows) => currentWindows.filter((windowState) => windowState.id !== id));
    if (activeWindowId === id) {
      setActiveWindowId(null);
    }
  }

  function minimizeWindow(id: string) {
    if (activeWindowId === id) {
      setActiveWindowId(null);
    }

    setWindows((currentWindows) =>
      currentWindows.map((windowState) =>
        windowState.id === id ? { ...windowState, mode: "minimized" } : windowState,
      ),
    );
  }

  function toggleMaximize(id: string) {
    zIndexRef.current += 1;
    setActiveWindowId(id);
    setWindows((currentWindows) =>
      currentWindows.map((windowState) => {
        if (windowState.id !== id) {
          return windowState;
        }

        if (windowState.mode === "maximized") {
          return {
            ...windowState,
            ...(windowState.previousBounds ?? {}),
            mode: "floating",
            zIndex: zIndexRef.current,
          };
        }

        return {
          ...windowState,
          previousBounds: {
            x: windowState.x,
            y: windowState.y,
            width: windowState.width,
            height: windowState.height,
          },
          mode: "maximized",
          zIndex: zIndexRef.current,
        };
      }),
    );
  }

  function restoreFromTaskbar(id: string) {
    zIndexRef.current += 1;
    setActiveWindowId(id);
    setWindows((currentWindows) =>
      currentWindows.map((windowState) =>
        windowState.id === id
          ? {
              ...windowState,
              mode: windowState.mode === "minimized" ? "floating" : windowState.mode,
              zIndex: zIndexRef.current,
            }
          : windowState,
      ),
    );
  }

  function handleRootPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!startMenuOpen) {
      return;
    }

    const target = event.target as Node;
    if (startMenuRef.current?.contains(target) || startButtonRef.current?.contains(target)) {
      return;
    }

    setStartMenuOpen(false);
  }

  const visibleWindows = useMemo(
    () => windows.filter((windowState) => windowState.mode !== "minimized"),
    [windows],
  );

  return (
    <div
      className={rootClassName}
      style={style}
      aria-label="ScreenOS Hackathon"
      aria-disabled={!interactive}
      onPointerDownCapture={handleRootPointerDown}
    >
      <div className={styles.desktop} ref={desktopRef}>
        <Image
          className={styles.wallpaperLogo}
          src="/ingenia-logo.svg"
          alt=""
          width={498}
          height={178}
          draggable={false}
          unoptimized
        />

        <div className={styles.desktopIcons} aria-label="Aplicaciones del escritorio">
          {DESKTOP_APPS.map((app) => (
            <button
              key={app.id}
              type="button"
              className={styles.desktopIcon}
              onClick={() => openApp(app.id)}
              disabled={!interactive}
            >
              <ScreenIcon src={app.iconSrc} alt="" />
              <span>{app.desktopLabel}</span>
            </button>
          ))}
        </div>

        {visibleWindows.map((windowState) => {
          const isMaximized = windowState.mode === "maximized";
          const windowStyle: CSSProperties = isMaximized
            ? { inset: 0, zIndex: windowState.zIndex }
            : {
                left: windowState.x,
                top: windowState.y,
                width: windowState.width,
                height: windowState.height,
                zIndex: windowState.zIndex,
              };

          return (
            <section
              key={windowState.id}
              className={`${styles.window} ${isMaximized ? styles.maximizedWindow : ""}`}
              data-active={windowState.id === activeWindowId}
              style={windowStyle}
              onPointerDown={() => bringToFront(windowState.id)}
              aria-label={windowState.title}
            >
              <div className={styles.windowHeader} onPointerDown={(event) => beginMove(event, windowState)}>
                <span>{windowState.title}</span>
                <div
                  className={styles.windowActions}
                  onPointerDown={(event) => event.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      minimizeWindow(windowState.id);
                    }}
                    title="Minimizar"
                  >
                    _
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleMaximize(windowState.id);
                    }}
                    title="Maximizar"
                  >
                    {isMaximized ? "[]" : "[ ]"}
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      closeWindow(windowState.id);
                    }}
                    title="Cerrar"
                  >
                    X
                  </button>
                </div>
              </div>
              <div className={styles.windowBody}>
                <WindowContent appId={windowState.appId} onOpenApp={openApp} />
              </div>
              {!isMaximized ? (
                <div
                  className={styles.resizeHandle}
                  onPointerDown={(event) => beginResize(event, windowState)}
                  aria-hidden="true"
                />
              ) : null}
            </section>
          );
        })}
      </div>

      <div className={styles.taskbar}>
        <button
          type="button"
          ref={startButtonRef}
          className={styles.startButton}
          onClick={() => setStartMenuOpen((isOpen) => !isOpen)}
          aria-expanded={startMenuOpen}
          disabled={!interactive}
        >
          <Image src="/favicon.svg" alt="" width={24} height={24} draggable={false} unoptimized />
          <span>IN</span>
        </button>

        {startMenuOpen ? (
          <div className={styles.startMenu} ref={startMenuRef}>
            <div className={styles.startMenuHeader}>
              <Image src="/favicon.svg" alt="" width={38} height={38} draggable={false} unoptimized />
              <div>
                <strong>Ingenia OS</strong>
                <span>Hackathon workspace</span>
              </div>
            </div>

            <div className={styles.startMenuSection}>
              <p>Aplicaciones</p>
              {DESKTOP_APPS.map((app) => (
                <button key={app.id} type="button" onClick={() => openApp(app.id)}>
                  <ScreenIcon src={app.iconSrc} alt="" />
                  <span>{app.title}</span>
                </button>
              ))}
            </div>

            <div className={styles.startMenuSection}>
              <p>Recientes</p>
              {recentApps.length ? (
                recentApps.map((appId) => (
                  <button key={appId} type="button" onClick={() => openApp(appId)}>
                    <ScreenIcon src={APPS[appId].iconSrc} alt="" />
                    <span>{APPS[appId].title}</span>
                  </button>
                ))
              ) : (
                <span className={styles.emptyRecent}>Sin actividad reciente</span>
              )}
            </div>
          </div>
        ) : null}

        <div className={styles.taskbarDivider} />

        <div className={styles.taskbarApps} aria-label="Ventanas abiertas">
          {windows.map((windowState) => (
            <button
              key={windowState.id}
              type="button"
              className={windowState.id === activeWindowId ? styles.activeTaskbarApp : undefined}
              data-minimized={windowState.mode === "minimized"}
              onClick={() => restoreFromTaskbar(windowState.id)}
              title={windowState.title}
            >
              <ScreenIcon src={APPS[windowState.appId].iconSrc} alt="" />
            </button>
          ))}
        </div>

        <div className={styles.clock} aria-label="Hora actual">
          {clock}
        </div>
      </div>
    </div>
  );
}
