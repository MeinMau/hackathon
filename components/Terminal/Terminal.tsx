"use client";

import { ChangeEvent, FormEvent, RefObject, useEffect, useRef, useState } from "react";
import styles from "./Terminal.module.css";

const intro = [`               +@@-                        
               .                         
          -#:  %%% .@@##@@@@#  =*:          
      :#@@@%   +@@:.@@@-  @@@   @@@*.      
    @@@@       +@@:.@@@   +@@      -@@@@   
    .#@@@*     +@@:.@@@   +@@    #@@@*     
        =%@@   +@@:.@@@   +@@  @@#                                      
                                         `,
  "Hackathon ISND [v06/08/26]",
  "Ingeniería de Software y Desarrollo de Negocios, IEST Anahuac.",
];

const hackathonInfo = [
  String.raw`     _       _                INFORMACION GENERAL`,
  String.raw`  __| |__   (_) _ __          Hackathon ISND - INGENIA "<in>hack>"`,
  String.raw` / _  '_ \  | || '_ \         IEST Anahuac`,
  String.raw`| (_| | | | | || | | |        Sistemas y Negocios Digitales`,
  String.raw` \__,_| |_| |_||_| |_|        Primer Concurso de Programacion`,
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

const infoCommands = new Set(["hackaton", "hackathon", "info", "informacion"]);

type TerminalInputProps = {
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  inputRef: RefObject<HTMLInputElement | null>;
};

function TerminalInput({ value, onChange, onSubmit, inputRef }: TerminalInputProps) {
  return (
    <>
      <div className={styles.inputLine}>
        <p>{'C:/hackathon>'}</p>
        <form onSubmit={onSubmit}>
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={onChange}
            className={styles.input}
          />
        </form>
      </div>
    </>
  );

}

export default function Terminal() {
  const [output, setOutput] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!inputValue.trim()) return;
    const input = "C:/hackathon>" + inputValue.trim();
    setOutput((o) => [...o, input]);
    setInputValue("");
    requestAnimationFrame(() => inputRef.current?.focus());
    checkCommand(inputValue.trim());
  }

  function checkCommand(command: string) {
    const normalizedCommand = command
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    const commandTokens = normalizedCommand.match(/[a-z0-9]+/g) ?? [];

    if (commandTokens.some((token) => infoCommands.has(token))) {
      setOutput((o) => [...o, ...hackathonInfo]);
      return;
    }

    switch (normalizedCommand) {
      case "help":
        setOutput((o) => [
          ...o,
          "Comandos: help, about, clear, hackaton, info, informacion",
        ]);
        break;
      case "about":
        setOutput((o) => [...o, "This is a simple terminal emulator."]);
        break;
      case "clear":
        setOutput([]);
        break;
      default:
        setOutput((o) => [...o, `${command} no se reconoce como un comando interno o externo,
programa o archivo por lotes ejecutable.

`]);
    }
  }

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [output, inputValue]);

  return (
    <div className={styles.background} aria-hidden>
      <div className={styles.window}>
        <div ref={contentRef} className={styles.content}>
          {intro.map((line, i) => (
            <div key={i} className={styles.line}>
              {line}
            </div>
          ))}

          <br />

          {output.map((line, i) => (
            <div key={i} className={styles.line}>
              {line}
            </div>
          ))}

          <TerminalInput
            value={inputValue}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setInputValue(e.target.value)
            }
            onSubmit={handleSubmit}
            inputRef={inputRef}
          />
        </div>
      </div>
    </div>
  );
}

