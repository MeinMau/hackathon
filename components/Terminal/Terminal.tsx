"use client";

import React, { useEffect, useRef, useState } from "react";
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

function TerminalInput({ value, onChange, onSubmit, inputRef }: any) {
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
  const [currentLine, setCurrentLine] = useState("");
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!inputValue.trim()) return;
    const input = "C:/hackathon>" + inputValue.trim();
    setOutput((o) => [...o, input]);
    setInputValue("");
    requestAnimationFrame(() => inputRef.current?.focus());
    checkCommand(inputValue.trim());
  }

  function checkCommand(command: string) {
    switch (command) {
      case "help":
        setOutput((o) => [
          ...o,
          "Comandos: lp, about, clear",
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
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
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

