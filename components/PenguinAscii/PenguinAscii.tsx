"use client";

import { useEffect, useState } from "react";
import styles from "./PenguinAscii.module.css";

const frames = [String.raw`
            _____   
          ,888888b.  
        .d888888888b   
    _..-'.\`*'_,88888b  
  ,'..-..\`"ad88888888b. 
         \`\`-. \`*Y888888b.    
             \\   \`Y888888b.  
             :     Y8888888b.    
             :      Y88888888b.                                
             |    _,8ad88888888. 
             : .d88888888888888b.
             \\d888888888888888888 
             8888;'''\`88888888888 
             888'     Y8888888888   
             \`Y8      :8888888888  
              |\`      '8888888888 
              |        8888888888 
              |        8888888888 
              |        8888888888 
              :       ;888888888' 
               \\      d88888888' 
              _.>,    888888P'
            <,--''\`.._>8888( 
             \`>__...--'                                
                                                              
`
];

export default function PenguinAscii() {

  return (
    <div className={styles.wrapper}>
      <pre className={styles.ascii}>{frames[0]}</pre>
    </div>
  );
}
