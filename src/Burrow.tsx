import type { Action } from "../shared/game";

export function Hamster({
  x = 0,
  y = 0,
  scale = 1,
  color = "#c58c52",
  sleep = false,
  scarf = "#72866a",
  flip = false,
}: {
  x?: number;
  y?: number;
  scale?: number;
  color?: string;
  sleep?: boolean;
  scarf?: string;
  flip?: boolean;
}) {
  return (
    <g
      transform={`translate(${x} ${y}) scale(${flip ? -scale : scale} ${scale})`}
    >
      <ellipse cx="0" cy="32" rx="26" ry="6" fill="#442a1d" opacity=".17" />
      <ellipse cx="-14" cy="29" rx="9" ry="5" fill="#c07c4b" />
      <ellipse cx="13" cy="29" rx="9" ry="5" fill="#c07c4b" />
      <ellipse cy="8" rx="27" ry="26" fill={color} />
      <ellipse cy="15" rx="20" ry="18" fill="#f9e6bf" />
      <circle cx="-18" cy="-15" r="11" fill={color} />
      <circle cx="18" cy="-15" r="11" fill={color} />
      <circle cx="-18" cy="-15" r="6" fill="#e9ac96" />
      <circle cx="18" cy="-15" r="6" fill="#e9ac96" />
      <ellipse cy="-2" rx="27" ry="23" fill={color} />
      <path
        d="M-23 2C-18-9-7-9 0-2c7-7 18-7 23 4 0 16-46 19-46 0"
        fill="#fbebce"
      />
      <ellipse cx="-16" cy="5" rx="6" ry="3" fill="#e5a18c" opacity=".7" />
      <ellipse cx="16" cy="5" rx="6" ry="3" fill="#e5a18c" opacity=".7" />
      {sleep ? (
        <g stroke="#493a2d" strokeWidth="2" fill="none" strokeLinecap="round">
          <path d="m-14-2 4 2 4-2m12 0 4 2 4-2" />
        </g>
      ) : (
        <g fill="#3c3028">
          <ellipse cx="-10" cy="-2" rx="2.7" ry="3.8" />
          <ellipse cx="10" cy="-2" rx="2.7" ry="3.8" />
          <circle cx="-9.3" cy="-3.2" r=".8" fill="white" />
          <circle cx="10.7" cy="-3.2" r=".8" fill="white" />
        </g>
      )}
      <path d="m-3 4 3 3 3-3Z" fill="#bd826f" />
      <path
        d="M0 7v3m-5-1c2 3 3 3 5 1 2 2 3 2 5-1"
        stroke="#624638"
        fill="none"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path d="M-22 13q22 10 44 0l-1 7q-22 10-42-1Z" fill={scarf} />
      <path d="m13 18 3 14 8-4-3-13Z" fill={scarf} />
      <ellipse
        cx="-23"
        cy="16"
        rx="5"
        ry="8"
        fill={color}
        transform="rotate(-25 -23 16)"
      />
      <ellipse
        cx="23"
        cy="16"
        rx="5"
        ry="8"
        fill={color}
        transform="rotate(25 23 16)"
      />
    </g>
  );
}
export function Avatar({
  kind = 0,
  size = 44,
}: {
  kind?: number;
  size?: number;
}) {
  const colors = ["#c89155", "#a3a19a", "#b07a48", "#d9b77e"];
  return (
    <svg
      className={`avatar avatar-${kind % 4}`}
      width={size}
      height={size}
      viewBox="-36 -34 72 72"
      aria-hidden="true"
    >
      <Hamster
        scale={1.05}
        color={colors[kind % 4]}
        scarf={["#66815b", "#bf764c", "#638b8a", "#ac7992"][kind % 4]}
      />
    </svg>
  );
}

function Lantern({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r="31" fill="#ffd98b" opacity=".09" />
      <circle r="20" fill="#ffd98b" opacity=".12" />
      <path d="M0-24v10" stroke="#533d2a" strokeWidth="2" />
      <path d="M-5-11q5-10 10 0" fill="none" stroke="#77502d" strokeWidth="2" />
      <path
        d="m-7-10-2 18h18l-2-18Z"
        fill="#f9cc77"
        stroke="#8d5e32"
        strokeWidth="2"
      />
      <path
        d="M-9-11H9M-11 10h22"
        stroke="#77502d"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M0-6v12"
        stroke="#fff3c5"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </g>
  );
}
function Grass({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g
      transform={`translate(${x} ${y}) scale(${scale})`}
      fill="none"
      stroke="#6d8151"
      strokeWidth="3"
      strokeLinecap="round"
    >
      <path d="M0 1q-10-14-14-12M0 1q-1-17 3-20M0 1q9-11 15-12" />
    </g>
  );
}
export function Burrow({
  selected,
  shelter,
  night = false,
}: {
  selected: Action;
  shelter: number;
  night?: boolean;
}) {
  const room = {
    forage: "pantry",
    fortify: "workshop",
    explore: "tunnel",
    rest: "nest",
  }[selected];
  return (
    <svg
      className={`burrow-art room-${room} ${night ? "night" : ""}`}
      viewBox="0 0 900 450"
      role="img"
      aria-labelledby="burrow-title burrow-desc"
    >
      <title id="burrow-title">The Bramblewood burrow</title>
      <desc id="burrow-desc">
        An illustrated cutaway of a hamster home under an old oak: a stocked
        pantry, a workshop, a sleeping nest, and an exploring tunnel.{" "}
        {shelter < 30
          ? "The shelter needs repairs."
          : "Warm lanterns glow in the chambers."}
      </desc>
      <defs>
        <linearGradient id="sky" x2="0" y2="1">
          <stop stopColor={night ? "#849099" : "#dfe5c9"} />
          <stop offset="1" stopColor="#eef0d5" />
        </linearGradient>
        <linearGradient id="earth" x2="0" y2="1">
          <stop stopColor="#997951" />
          <stop offset="1" stopColor="#70553b" />
        </linearGradient>
        <linearGradient id="room" x2="0" y2="1">
          <stop stopColor="#caa77a" />
          <stop offset="1" stopColor="#e3c296" />
        </linearGradient>
        <pattern
          id="earth-speckle"
          width="52"
          height="48"
          patternUnits="userSpaceOnUse"
        >
          <ellipse cx="8" cy="10" rx="3" ry="2" fill="#c2a17a" opacity=".5" />
          <path
            d="m30 32 5-2m-10-16 3 1"
            stroke="#543d2a"
            opacity=".2"
            strokeWidth="2"
          />
          <circle cx="45" cy="42" r="1.7" fill="#ddbd8c" opacity=".5" />
        </pattern>
        <pattern
          id="woodgrain"
          width="26"
          height="18"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M0 6q10-5 26 0M0 14q16 5 26 0"
            fill="none"
            stroke="#5a422c"
            opacity=".15"
          />
        </pattern>
      </defs>
      <path fill="url(#sky)" d="M0 0h900v450H0Z" />
      <circle cx="735" cy="41" r="24" fill="#f6e9ad" />
      <path d="M0 86Q120 1 260 83T530 80 900 37v111H0" fill="#c7d2ac" />
      <path d="M0 107q136-63 277-7t278-13 345 18v59H0" fill="#b0c094" />
      <g fill="#879f78" opacity=".4">
        <path d="m48 14-30 64h60ZM828 5l-26 66h53Zm46 23-20 49h42Z" />
      </g>
      <path
        d="M0 151Q128 128 254 144T522 141 900 147v303H0Z"
        fill="url(#earth)"
      />
      <path
        d="M0 151Q128 128 254 144T522 141 900 147v303H0Z"
        fill="url(#earth-speckle)"
      />
      <path
        d="M0 148Q128 125 254 141T522 138 900 144"
        fill="none"
        stroke="#637b45"
        strokeWidth="11"
      />
      <path
        d="M340-20q-11 65-4 130l-42 35 71-12 38 25-7-32 32 16-27-41-2-121"
        fill="#836742"
      />
      <path
        d="M366-8q-11 67-4 123m22-111-2 118"
        fill="none"
        stroke="#a48a5f"
        strokeWidth="5"
      />
      <g fill="#728357">
        <ellipse cx="311" cy="4" rx="117" ry="47" />
        <ellipse cx="415" cy="-7" rx="113" ry="62" />
        <ellipse cx="359" cy="-18" rx="137" ry="58" />
      </g>
      <g fill="#85966a">
        <ellipse cx="260" cy="2" rx="64" ry="29" />
        <ellipse cx="455" cy="-4" rx="61" ry="33" />
      </g>
      <path d="M557 143v-21q0-42 39-42t39 42v21" fill="#514730" />
      <path
        d="M546 143v-22q0-53 50-53t50 53v22"
        fill="none"
        stroke="#b29c6b"
        strokeWidth="12"
      />
      <path d="M574 147v-25q0-24 22-24t22 24v25" fill="#ae8550" />
      <path
        d="M594 99v46m-14-41v41m29-41v41"
        stroke="#8d693d"
        strokeWidth="2"
      />
      <circle cx="606" cy="128" r="3" fill="#e1bd77" />
      <path
        d="M666 142v-40m-19 2h40l-2-23h-40Z"
        fill="#b8955f"
        stroke="#8d7049"
        strokeWidth="2"
      />
      <path
        d="m658 92 16 0m-4-4 4 4-4 4"
        stroke="#725435"
        strokeWidth="2"
        fill="none"
      />
      <Grass x={80} y={140} />
      <Grass x={204} y={140} scale={0.8} />
      <Grass x={480} y={138} />
      <Grass x={700} y={141} scale={0.8} />
      <Grass x={853} y={142} />
      <g fill="#d69960">
        <path d="M95 142v-17q-14-9 0-15 15 5 1 15m11 17v-11q-10-6 0-10 10 4 0 10" />
      </g>
      <g transform="translate(778 111)">
        <path d="M-4 27V0M0 22l14-9" stroke="#819157" strokeWidth="3" />
        <path
          d="M-14 2Q-2-8 3 5q-12 8-17-3m15 16q8-12 17-6-2 14-17 6"
          fill="#97a36b"
        />
        <circle cy="-5" r="5" fill="#eac76e" />
      </g>
      <path
        d="M596 151v28q0 23-34 23H440q-38 0-38 39v51q0 28-33 28H263m139-84h-91m108 66h167q30 0 30 26v25m0-26h123"
        fill="none"
        stroke="#5b422e"
        strokeWidth="46"
        strokeLinecap="round"
      />
      <path
        d="M596 151v28q0 23-34 23H440q-38 0-38 39v51q0 28-33 28H263m139-84h-91m108 66h167q30 0 30 26v25m0-26h123"
        fill="none"
        stroke="#bf9a6b"
        strokeWidth="31"
        strokeLinecap="round"
      />
      <path
        d="M87 234q0-54 71-54h94q66 0 66 58v25q0 35-53 35H135q-48 0-48-40Z"
        className={`chamber ${room === "pantry" ? "chosen" : ""}`}
        fill="url(#room)"
        stroke="#614832"
        strokeWidth="11"
      />
      <path
        d="M85 376q0-54 70-54h139q38 0 38 40v33q0 25-34 25H119q-34 0-34-27Z"
        className={`chamber ${room === "nest" ? "chosen" : ""}`}
        fill="url(#room)"
        stroke="#614832"
        strokeWidth="11"
      />
      <path
        d="M461 237q0-37 52-37h102q45 0 45 43v29q0 39-45 39H501q-40 0-40-39Z"
        className={`chamber ${room === "workshop" ? "chosen" : ""}`}
        fill="url(#room)"
        stroke="#614832"
        strokeWidth="11"
      />
      <path
        d="M713 353q0-48 62-48h70q47 0 47 49v31q0 29-39 29h-94q-46 0-46-32Z"
        className={`chamber ${room === "tunnel" ? "chosen" : ""}`}
        fill="url(#room)"
        stroke="#614832"
        strokeWidth="11"
      />
      <g fill="none" stroke="#906e49" strokeWidth="5" strokeLinecap="round">
        <path d="M119 274h165M119 235h91M110 234v42m100-42v42M476 291h165m-165-38v38m165-38v38M736 390h131" />
      </g>
      <g fill="#ba7a44" stroke="#916037" strokeWidth="1.5">
        <path d="M125 233v-25h24v25m7 0v-18h22v18" />
        <path d="M128 209q12 5 21 0m8 6q10 4 20 0" fill="none" />
        <rect x="119" y="252" width="32" height="21" rx="3" />
        <path d="m154 270 6-21h24l7 21Z" fill="#8e9b60" />
        <rect x="193" y="248" width="21" height="25" rx="4" fill="#ddab66" />
      </g>
      <g fill="#e8c97f">
        <ellipse cx="134" cy="249" rx="13" ry="4" />
        <ellipse cx="171" cy="248" rx="10" ry="4" />
        <ellipse cx="204" cy="247" rx="8" ry="3" />
      </g>
      <g transform="translate(260 263)">
        <path d="M-14 9q-9-14-4-28h28q6 17-2 28Z" fill="#b79159" />
        <path
          d="M-14-18q10-8 25 0"
          stroke="#927344"
          fill="none"
          strokeWidth="3"
        />
        <g fill="#dfbb72">
          <ellipse cx="-3" cy="-18" rx="4" ry="7" transform="rotate(30)" />
          <ellipse cx="5" cy="-20" rx="4" ry="7" transform="rotate(-20)" />
        </g>
      </g>
      <Hamster x={232} y={253} scale={0.68} scarf="#7b8d61" />
      <g transform="translate(142 369)">
        <ellipse cx="30" cy="24" rx="54" ry="20" fill="#a89462" />
        <ellipse cx="30" cy="18" rx="48" ry="17" fill="#dfc77d" />
        <path
          d="M-11 19q30-21 81 0"
          fill="none"
          stroke="#eed9a1"
          strokeWidth="3"
        />
        <path
          d="M-13 22q30-14 86 0"
          fill="none"
          stroke="#c4a861"
          strokeWidth="3"
        />
      </g>
      <Hamster
        x={176}
        y={370}
        scale={0.7}
        color="#b7b1a2"
        scarf="#b77758"
        sleep
      />
      <path d="M152 382q25-19 46 1v14h-47Z" fill="#9aaa84" />
      <path d="M162 386h27m-22 5h15" stroke="#c0c9a3" strokeWidth="2" />
      <g fill="#9f7549" stroke="#795634" strokeWidth="2">
        <path d="m255 400 33-1v-34h-33Z" />
        <path d="m256 374 30-1m-26-8v34m19-34v34" fill="none" />
      </g>
      <g transform="translate(548 267)">
        <path
          d="M-50 7H21v7h-71Zm6 6v24m57-24v24"
          fill="#977044"
          stroke="#775331"
          strokeWidth="2"
        />
        <path d="m-38 2 26-9 4 5-26 10Z" fill="#e4c080" />
        <path d="m-27-2-3-15 6-3 6 15" fill="#766552" />
        <path
          d="M-30-20h13"
          stroke="#696653"
          strokeWidth="7"
          strokeLinecap="round"
        />
      </g>
      <Hamster x={595} y={272} scale={0.69} color="#d0a36d" scarf="#688686" />
      <g transform="translate(740 364)">
        <path
          d="m1 20 44-5m-37-6 39 7m-39-5L1-1l41-7 8 13"
          fill="#ad8051"
          stroke="#845e38"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <ellipse cx="3" cy="20" rx="5" ry="4" fill="#c69a65" />
        <ellipse cx="45" cy="15" rx="5" ry="4" fill="#c69a65" />
      </g>
      <Hamster x={832} y={369} scale={0.75} color="#b68552" scarf="#bd7a49" />
      <path
        d="m800 341 7-17 28 8-5 15Z"
        fill="#d8caa4"
        stroke="#a28c5e"
        strokeWidth="1.5"
      />
      <path
        d="m811 330 4 5 5-4 7 7"
        stroke="#9caa81"
        fill="none"
        strokeWidth="2"
      />
      <Lantern x={296} y={209} />
      <Lantern x={317} y={351} />
      <Lantern x={641} y={226} />
      <Lantern x={733} y={328} />
      <g fill="#b9986b">
        <ellipse cx="361" cy="386" rx="10" ry="7" />
        <ellipse cx="686" cy="257" rx="7" ry="5" />
        <ellipse cx="45" cy="337" rx="9" ry="6" />
        <ellipse cx="453" cy="393" rx="6" ry="4" />
        <ellipse cx="852" cy="207" rx="9" ry="5" />
      </g>
      <g stroke="#b59564" strokeWidth="3" fill="none" strokeLinecap="round">
        <path d="m360 144 5 37 12 11m-11-22 13 5M326 145l-17 16-1 11m-9-13-10 3M402 145l26 24 7 1M483 143l-4 28-12 11" />
      </g>
      <g fill="#e0d2ac" opacity=".8">
        <circle cx="463" cy="63" r="2" />
        <circle cx="470" cy="78" r="1.5" />
        <circle cx="244" cy="102" r="2" />
        <circle cx="758" cy="82" r="2" />
      </g>
      {shelter < 30 && (
        <g stroke="#503d2d" fill="none" strokeWidth="3">
          <path d="m450 158-7 22 10 14-8 20m225 132-10 12 8 16-10 12" />
        </g>
      )}
    </svg>
  );
}
