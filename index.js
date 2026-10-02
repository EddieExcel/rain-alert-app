// The watchdog's TaskManager.defineTask must run at import time.
import "./src/watchdog";

import { registerRootComponent } from "expo";
import App from "./App";

registerRootComponent(App);
