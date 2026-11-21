# Credits & External Sources — Anti-Microsleep

This document discloses all third-party models, open-source libraries, datasets, audio assets, and AI development tools used in the **Anti-Microsleep** project, in compliance with competition rules and open-source licensing.

---

## 1. AI Models & Computer Vision
| Component | Source / Author | License / Usage |
| :--- | :--- | :--- |
| **MediaPipe Face Landmarker (`face_landmarker.task`)** & **Face Blendshapes (`face_blendshapes.tflite`)** | Google MediaPipe | Apache-2.0 — 478 facial landmarks & blendshape scores run locally via LiteRT |
| **`ai-edge-litert`** | Google AI Edge | Apache-2.0 — On-device TFLite/LiteRT inference runtime on Arduino UNO Q (ARM Cortex-A53) |
| **OpenCV & `haarcascade_eye_tree_eyeglasses.xml`** | OpenCV Team | Apache-2.0 — Image processing & glasses eye-visibility check |
| **Arduino App Lab (`arduino:web_ui`, `arduino:object_detection` / YOLOX)** | Arduino | Arduino App Lab runtime bricks on Arduino UNO Q |
| **Roboflow (`eye_close_project/2`)** *(optional cloud second-opinion, disabled in offline competition mode)* | Roboflow | Optional cloud verification model (disabled during offline demo) |

---

## 2. Offline Maps, GPS & Routing
| Component | Source / Author | License / Usage |
| :--- | :--- | :--- |
| **Thailand Map Data & POIs** | OpenStreetMap Contributors | ODbL — Road network & 22,614 fuel/rest-area/cafe POIs |
| **Thailand OSM Extract** | Geofabrik | ODbL — Regional `.osm.pbf` extract |
| **OSRM (Open Source Routing Machine)** | Project OSRM | BSD-2-Clause — Local offline road distance & route geometry (`osrm-routed`) |
| **Leaflet** | Volodymyr Agafonkin / Leaflet Contributors | BSD-2-Clause — Interactive map UI on driver & company web pages |
| **Protomaps (`go-pmtiles`, `protomaps-leaflet`)** | Protomaps | BSD-3-Clause — Offline Thailand vector map tiles (`thailand.pmtiles`) |
| **Nominatim** | OpenStreetMap | ODbL — Reverse geocoding coordinates to Thai addresses on company dashboard |

---

## 3. Audio & Voice Prompts
| Component | Source / Author | Usage |
| :--- | :--- | :--- |
| **Thai Voice Prompts (`voice_learning.wav`, `voice_ready.wav`)** | Microsoft Neural TTS (`th-TH-Premwadee`) | Spoken Thai prompts: "learning your eyes" and "system ready" |
| **Alarm Tone (`board/sounds/beep.wav`)** | Provided by the team *(original source to be confirmed by the team)* | Local audible microsleep / rest-end alarm on the USB speaker |

---

## 4. Web Stack, Firmware & Infrastructure
| Component | Source / Author | License / Usage |
| :--- | :--- | :--- |
| **Arduino Core, `Arduino_RouterBridge`, `Arduino_LED_Matrix`** | Arduino | LGPL / Open-Source — STM32U585 MCU firmware & Linux-MCU bridge on Genuine Arduino UNO Q |
| **Next.js & React** | Vercel / Meta | MIT — Company fleet management dashboard (`company-web/`) |
| **`postgres` (Postgres.js), `bcryptjs`, `jose`** | Open-Source Contributors | Unlicense / MIT — Parameterized PostgreSQL queries, password hashing, and JWT sessions |
| **Vercel & Supabase** | Vercel / Supabase | Cloud hosting & managed PostgreSQL database |
| **LINE Messaging API** | LY Corporation (LINE) | Optional 60-second unacknowledged alert escalation |

---

## 5. AI Development Assistants
| Tool | Role in Development |
| :--- | :--- |
| **Claude (Anthropic)** | Assisted with debugging, UI refactoring, documentation, and testing scripts |
| **Antigravity / Gemini (Google DeepMind)** | Assisted with 3D case CAD scripting (`fusion360_build_case.py`), networking/QR setup, and code/rule auditing |

*All system architecture, hardware integration, real-world testing, squint-vs-closed-eye physical observation (eyelid curvature), and final engineering decisions were performed and validated by the Anti-Microsleep Team.*
