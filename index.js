var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.tsx
var index_exports = {};
__export(index_exports, {
  onLoad: () => onLoad,
  onUnload: () => onUnload,
  settings: () => settings
});
module.exports = __toCommonJS(index_exports);
var import_metro = require("@vendetta/metro");
var import_common = require("@vendetta/metro/common");
var import_plugin = require("@vendetta/plugin");
var import_storage = require("@vendetta/storage");
var import_components = require("@vendetta/ui/components");
var import_toasts = require("@vendetta/ui/toasts");
var { View, TextInput, ScrollView, TouchableOpacity, Text, StyleSheet } = import_common.ReactNative;
var { FormSection, FormRow, FormSwitch, FormDivider, FormInput, FormText } = import_components.Forms;
var FluxDispatcher = (0, import_metro.findByProps)("dispatch", "subscribe");
var UserStore = (0, import_metro.findByStoreName)("UserStore");
var ChannelStore = (0, import_metro.findByStoreName)("ChannelStore");
var SelectedChannelStore = (0, import_metro.findByStoreName)("SelectedChannelStore");
var _idCounter = 0;
function uniqueSnowflake(date) {
  const offset = _idCounter++ % 4096;
  const ms = Math.max(0, date.getTime() - 14200704e5);
  try {
    return (BigInt(ms) << 22n | BigInt(offset)).toString();
  } catch {
    return `${date.getTime()}${offset}${Math.floor(Math.random() * 999)}`;
  }
}
function randomSeconds(date) {
  const sec = 1 + Math.floor(Math.random() * 59);
  return new Date(date.getTime() + sec * 1e3);
}
var STORAGE_KEY = "fakes";
function loadPersisted() {
  try {
    const raw = import_plugin.storage[STORAGE_KEY];
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}
function savePersisted(fakes) {
  try {
    import_plugin.storage[STORAGE_KEY] = fakes;
  } catch {
  }
}
function removePersisted(channelId, ids) {
  const fakes = loadPersisted().filter(
    (f) => !(f.channelId === channelId && ids.has(f.snowflakeId))
  );
  savePersisted(fakes);
}
var fakeIds = /* @__PURE__ */ new Map();
function registerFake(channelId, id) {
  if (!fakeIds.has(channelId)) fakeIds.set(channelId, /* @__PURE__ */ new Set());
  fakeIds.get(channelId).add(id);
}
function clearFakes(channelId) {
  const ids = fakeIds.get(channelId);
  if (!ids?.size) return 0;
  let n = 0;
  for (const id of ids) {
    FluxDispatcher.dispatch({
      type: "MESSAGE_DELETE",
      channelId,
      id,
      mlDeleted: true
    });
    n++;
  }
  removePersisted(channelId, ids);
  ids.clear();
  return n;
}
function getCurrentDMChannel() {
  try {
    const chId = SelectedChannelStore.getChannelId?.();
    if (!chId) return null;
    const ch = ChannelStore.getChannel?.(chId);
    if (!ch || ch.type !== 1 && ch.type !== 3) return null;
    return ch;
  } catch {
    return null;
  }
}
function getChannelMembers() {
  try {
    const ch = getCurrentDMChannel();
    if (!ch) return [];
    const me = UserStore.getCurrentUser?.();
    const ids = ch.recipients ?? ch.rawRecipients?.map((r) => r.id) ?? [];
    const members = [];
    if (me) members.push(me);
    for (const id of ids) {
      if (id === me?.id) continue;
      const u = UserStore.getUser?.(id);
      if (u) members.push(u);
    }
    return members;
  } catch {
    return [];
  }
}
function buildAuthor(user) {
  return {
    id: user.id,
    username: user.username,
    discriminator: user.discriminator ?? "0",
    avatar: user.avatar ?? null,
    public_flags: user.publicFlags ?? 0,
    flags: user.flags ?? 0,
    banner: user.banner ?? null,
    accent_color: null,
    global_name: user.globalName ?? user.username,
    avatar_decoration_data: user.avatarDecorationData ? {
      asset: user.avatarDecorationData.asset,
      sku_id: user.avatarDecorationData.skuId
    } : null,
    banner_color: null
  };
}
function inject(channelId, author, content, date, persistedId) {
  const actualDate = persistedId ? date : randomSeconds(date);
  const id = persistedId ?? uniqueSnowflake(actualDate);
  FluxDispatcher.dispatch({
    type: "MESSAGE_CREATE",
    channelId,
    message: {
      attachments: [],
      components: [],
      embeds: [],
      mention_roles: [],
      mentions: [],
      author: buildAuthor(author),
      channel_id: channelId,
      content,
      edited_timestamp: null,
      flags: 0,
      id,
      mention_everyone: false,
      nonce: id,
      pinned: false,
      timestamp: actualDate.toISOString(),
      tts: false,
      type: 0
    },
    optimistic: false,
    isPushNotification: false
  });
  registerFake(channelId, id);
  if (!persistedId) {
    const fakes = loadPersisted();
    fakes.push({
      type: "message",
      channelId,
      authorId: author.id,
      content,
      timestamp: actualDate.toISOString(),
      snowflakeId: id
    });
    savePersisted(fakes);
  }
}
function injectCall(channelId, caller, other, missed, durationSec, date, persistedId, persistedEndedTs) {
  const actualDate = persistedId ? date : randomSeconds(date);
  const id = persistedId ?? uniqueSnowflake(actualDate);
  const participants = missed ? [caller.id] : [caller.id, other.id];
  const endedDate = missed ? actualDate : persistedEndedTs ? new Date(persistedEndedTs) : new Date(actualDate.getTime() + durationSec * 1e3);
  FluxDispatcher.dispatch({
    type: "MESSAGE_CREATE",
    channelId,
    message: {
      attachments: [],
      components: [],
      embeds: [],
      mention_roles: [],
      mentions: [],
      author: buildAuthor(caller),
      channel_id: channelId,
      content: "",
      edited_timestamp: null,
      flags: 0,
      id,
      mention_everyone: false,
      nonce: id,
      pinned: false,
      timestamp: actualDate.toISOString(),
      tts: false,
      type: 3,
      // CALL
      call: {
        participants,
        ended_timestamp: endedDate.toISOString(),
        duration: missed ? void 0 : durationSec
      }
    },
    optimistic: false,
    isPushNotification: false
  });
  registerFake(channelId, id);
  if (!persistedId) {
    const fakes = loadPersisted();
    fakes.push({
      type: "call",
      channelId,
      callerId: caller.id,
      otherId: other.id,
      missed,
      durationSec,
      timestamp: actualDate.toISOString(),
      endedTimestamp: endedDate.toISOString(),
      snowflakeId: id
    });
    savePersisted(fakes);
  }
}
function doRestore() {
  const fakes = loadPersisted();
  if (!fakes.length) return;
  for (const f of fakes) {
    if (f.type === "message") {
      const author = UserStore.getUser?.(f.authorId);
      if (!author) continue;
      inject(f.channelId, author, f.content, new Date(f.timestamp), f.snowflakeId);
    } else {
      const caller = UserStore.getUser?.(f.callerId);
      const other = UserStore.getUser?.(f.otherId);
      if (!caller || !other) continue;
      injectCall(
        f.channelId,
        caller,
        other,
        f.missed,
        f.durationSec,
        new Date(f.timestamp),
        f.snowflakeId,
        f.endedTimestamp
      );
    }
  }
}
var styles = StyleSheet.create({
  container: { flex: 1, paddingBottom: 40 },
  hint: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    opacity: 0.6,
    fontSize: 13
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginVertical: 4,
    color: "#fff",
    fontSize: 15
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.08)"
  },
  chipActive: {
    backgroundColor: "#5865f2"
  },
  chipText: { color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: "600" },
  chipTextActive: { color: "#fff" },
  btn: {
    marginHorizontal: 16,
    marginVertical: 6,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center"
  },
  btnPrimary: { backgroundColor: "#5865f2" },
  btnDanger: { backgroundColor: "rgba(237,66,69,0.25)" },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  btnTextDanger: { color: "#ed4245", fontWeight: "700", fontSize: 14 },
  sectionTitle: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    opacity: 0.45
  }
});
function memberLabel(u) {
  return u?.globalName || u?.username || u?.id || "?";
}
function toLocalInput(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
function Settings() {
  (0, import_storage.useProxy)(import_plugin.storage);
  const me = UserStore.getCurrentUser?.();
  const ch = getCurrentDMChannel();
  const channelId = SelectedChannelStore.getChannelId?.();
  const members = getChannelMembers();
  const isInDM = !!ch;
  const [mode, setMode] = import_common.React.useState("message");
  const [text, setText] = import_common.React.useState("");
  const [senderId, setSenderId] = import_common.React.useState(me?.id ?? "");
  const [callerId, setCallerId] = import_common.React.useState(me?.id ?? "");
  const [receiverId, setReceiverId] = import_common.React.useState(
    () => members.find((m) => m.id !== me?.id)?.id ?? me?.id ?? ""
  );
  const [missed, setMissed] = import_common.React.useState(false);
  const [durationMin, setDurationMin] = import_common.React.useState("5");
  const [dateStr, setDateStr] = import_common.React.useState(() => toLocalInput(/* @__PURE__ */ new Date()));
  import_common.React.useEffect(() => {
    if (me?.id) {
      setSenderId(me.id);
      setCallerId(me.id);
    }
    const other = members.find((m) => m.id !== me?.id);
    if (other) setReceiverId(other.id);
  }, [channelId]);
  function handleInjectMessage() {
    if (!isInDM || !channelId) {
      (0, import_toasts.showToast)("Open a DM or group DM first", 1);
      return;
    }
    if (!text.trim()) {
      (0, import_toasts.showToast)("Enter a message", 1);
      return;
    }
    const author = members.find((m) => m.id === senderId) ?? me;
    if (!author) return;
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      (0, import_toasts.showToast)("Invalid date", 1);
      return;
    }
    inject(channelId, author, text.trim(), date);
    setText("");
    setDateStr(toLocalInput(new Date(date.getTime() + 6e4)));
    (0, import_toasts.showToast)("Message injected \u2713", 0);
  }
  function handleInjectCall() {
    if (!isInDM || !channelId) {
      (0, import_toasts.showToast)("Open a DM or group DM first", 1);
      return;
    }
    const caller = members.find((m) => m.id === callerId);
    const receiver = members.find((m) => m.id === receiverId);
    if (!caller || !receiver) {
      (0, import_toasts.showToast)("Pick caller & receiver", 1);
      return;
    }
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      (0, import_toasts.showToast)("Invalid date", 1);
      return;
    }
    const durSec = missed ? 0 : Math.max(1, Math.round((parseFloat(durationMin) || 0) * 60));
    injectCall(channelId, caller, receiver, missed, durSec, date);
    setDateStr(toLocalInput(new Date(date.getTime() + 6e4)));
    (0, import_toasts.showToast)(missed ? "Missed call injected \u2713" : "Call injected \u2713", 0);
  }
  function handleClear() {
    if (!channelId) return;
    const n = clearFakes(channelId);
    (0, import_toasts.showToast)(`${n} fake${n !== 1 ? "s" : ""} deleted`, 0);
  }
  if (!isInDM) {
    return /* @__PURE__ */ import_common.React.createElement(ScrollView, { style: styles.container }, /* @__PURE__ */ import_common.React.createElement(Text, { style: styles.hint }, "Open a DM or group DM, then come back here to inject fake messages or calls for screenshots."));
  }
  return /* @__PURE__ */ import_common.React.createElement(ScrollView, { style: styles.container, keyboardShouldPersistTaps: "handled" }, /* @__PURE__ */ import_common.React.createElement(Text, { style: styles.hint }, "Current channel: ", ch?.name || ch?.id || "DM", " \xB7 fakes are local only"), /* @__PURE__ */ import_common.React.createElement(View, { style: styles.row }, /* @__PURE__ */ import_common.React.createElement(
    TouchableOpacity,
    {
      style: [styles.chip, mode === "message" && styles.chipActive],
      onPress: () => setMode("message")
    },
    /* @__PURE__ */ import_common.React.createElement(Text, { style: [styles.chipText, mode === "message" && styles.chipTextActive] }, "\u{1F4AC} Message")
  ), /* @__PURE__ */ import_common.React.createElement(
    TouchableOpacity,
    {
      style: [styles.chip, mode === "call" && styles.chipActive],
      onPress: () => setMode("call")
    },
    /* @__PURE__ */ import_common.React.createElement(Text, { style: [styles.chipText, mode === "call" && styles.chipTextActive] }, "\u{1F4DE} Call")
  )), /* @__PURE__ */ import_common.React.createElement(Text, { style: styles.sectionTitle }, "Date / time (local)"), /* @__PURE__ */ import_common.React.createElement(
    TextInput,
    {
      style: styles.input,
      value: dateStr,
      onChangeText: setDateStr,
      placeholder: "YYYY-MM-DDTHH:mm",
      placeholderTextColor: "rgba(255,255,255,0.3)",
      autoCapitalize: "none",
      autoCorrect: false
    }
  ), /* @__PURE__ */ import_common.React.createElement(View, { style: styles.row }, /* @__PURE__ */ import_common.React.createElement(
    TouchableOpacity,
    {
      style: styles.chip,
      onPress: () => setDateStr(toLocalInput(/* @__PURE__ */ new Date()))
    },
    /* @__PURE__ */ import_common.React.createElement(Text, { style: styles.chipText }, "Now")
  )), mode === "message" ? /* @__PURE__ */ import_common.React.createElement(import_common.React.Fragment, null, /* @__PURE__ */ import_common.React.createElement(Text, { style: styles.sectionTitle }, "From"), /* @__PURE__ */ import_common.React.createElement(View, { style: styles.row }, members.map((m) => /* @__PURE__ */ import_common.React.createElement(
    TouchableOpacity,
    {
      key: m.id,
      style: [styles.chip, senderId === m.id && styles.chipActive],
      onPress: () => setSenderId(m.id)
    },
    /* @__PURE__ */ import_common.React.createElement(
      Text,
      {
        style: [
          styles.chipText,
          senderId === m.id && styles.chipTextActive
        ]
      },
      memberLabel(m)
    )
  ))), /* @__PURE__ */ import_common.React.createElement(Text, { style: styles.sectionTitle }, "Message"), /* @__PURE__ */ import_common.React.createElement(
    TextInput,
    {
      style: [styles.input, { minHeight: 72, textAlignVertical: "top" }],
      value: text,
      onChangeText: setText,
      placeholder: "Message content\u2026",
      placeholderTextColor: "rgba(255,255,255,0.3)",
      multiline: true
    }
  ), /* @__PURE__ */ import_common.React.createElement(
    TouchableOpacity,
    {
      style: [styles.btn, styles.btnPrimary],
      onPress: handleInjectMessage
    },
    /* @__PURE__ */ import_common.React.createElement(Text, { style: styles.btnText }, "Inject Message")
  )) : /* @__PURE__ */ import_common.React.createElement(import_common.React.Fragment, null, /* @__PURE__ */ import_common.React.createElement(Text, { style: styles.sectionTitle }, "Caller"), /* @__PURE__ */ import_common.React.createElement(View, { style: styles.row }, members.map((m) => /* @__PURE__ */ import_common.React.createElement(
    TouchableOpacity,
    {
      key: m.id,
      style: [styles.chip, callerId === m.id && styles.chipActive],
      onPress: () => setCallerId(m.id)
    },
    /* @__PURE__ */ import_common.React.createElement(
      Text,
      {
        style: [
          styles.chipText,
          callerId === m.id && styles.chipTextActive
        ]
      },
      memberLabel(m)
    )
  ))), /* @__PURE__ */ import_common.React.createElement(Text, { style: styles.sectionTitle }, "Receiver"), /* @__PURE__ */ import_common.React.createElement(View, { style: styles.row }, members.map((m) => /* @__PURE__ */ import_common.React.createElement(
    TouchableOpacity,
    {
      key: m.id,
      style: [styles.chip, receiverId === m.id && styles.chipActive],
      onPress: () => setReceiverId(m.id)
    },
    /* @__PURE__ */ import_common.React.createElement(
      Text,
      {
        style: [
          styles.chipText,
          receiverId === m.id && styles.chipTextActive
        ]
      },
      memberLabel(m)
    )
  ))), /* @__PURE__ */ import_common.React.createElement(Text, { style: styles.sectionTitle }, "Call type"), /* @__PURE__ */ import_common.React.createElement(View, { style: styles.row }, /* @__PURE__ */ import_common.React.createElement(
    TouchableOpacity,
    {
      style: [styles.chip, !missed && styles.chipActive],
      onPress: () => setMissed(false)
    },
    /* @__PURE__ */ import_common.React.createElement(Text, { style: [styles.chipText, !missed && styles.chipTextActive] }, "\u2705 Answered")
  ), /* @__PURE__ */ import_common.React.createElement(
    TouchableOpacity,
    {
      style: [styles.chip, missed && { backgroundColor: "#ed4245" }],
      onPress: () => setMissed(true)
    },
    /* @__PURE__ */ import_common.React.createElement(Text, { style: [styles.chipText, missed && styles.chipTextActive] }, "\u274C Missed")
  )), !missed && /* @__PURE__ */ import_common.React.createElement(import_common.React.Fragment, null, /* @__PURE__ */ import_common.React.createElement(Text, { style: styles.sectionTitle }, "Duration (minutes)"), /* @__PURE__ */ import_common.React.createElement(
    TextInput,
    {
      style: styles.input,
      value: durationMin,
      onChangeText: setDurationMin,
      keyboardType: "numeric",
      placeholder: "5",
      placeholderTextColor: "rgba(255,255,255,0.3)"
    }
  )), /* @__PURE__ */ import_common.React.createElement(
    TouchableOpacity,
    {
      style: [styles.btn, styles.btnPrimary],
      onPress: handleInjectCall
    },
    /* @__PURE__ */ import_common.React.createElement(Text, { style: styles.btnText }, "Inject Call")
  )), /* @__PURE__ */ import_common.React.createElement(TouchableOpacity, { style: [styles.btn, styles.btnDanger], onPress: handleClear }, /* @__PURE__ */ import_common.React.createElement(Text, { style: styles.btnTextDanger }, "\u{1F5D1} Clear fakes in this channel")), /* @__PURE__ */ import_common.React.createElement(Text, { style: [styles.hint, { marginTop: 12 }] }, "Tip: inject a few messages with different timestamps, then take your screenshot. Clear removes only the fakes created by this plugin in the current channel."));
}
var restoreTimer = null;
var connectionHandler = null;
var onLoad = () => {
  connectionHandler = () => {
    if (connectionHandler) {
      try {
        FluxDispatcher.unsubscribe?.("CONNECTION_OPEN", connectionHandler);
      } catch {
      }
      connectionHandler = null;
    }
    restoreTimer = setTimeout(() => {
      restoreTimer = null;
      doRestore();
    }, 1500);
  };
  try {
    FluxDispatcher.subscribe?.("CONNECTION_OPEN", connectionHandler);
  } catch {
    restoreTimer = setTimeout(doRestore, 1500);
  }
};
var onUnload = () => {
  if (connectionHandler) {
    try {
      FluxDispatcher.unsubscribe?.("CONNECTION_OPEN", connectionHandler);
    } catch {
    }
    connectionHandler = null;
  }
  if (restoreTimer) {
    clearTimeout(restoreTimer);
    restoreTimer = null;
  }
  fakeIds.clear();
  _idCounter = 0;
};
var settings = Settings;
