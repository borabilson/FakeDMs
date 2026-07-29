/**
 * FakeDM — Kettu / Vendetta / Bunny / Revenge compatible
 *
 * Injects fake local messages & calls into the current DM / group DM
 * so you can take screenshots. Client-side only.
 *
 * Usage: enable the plugin → open a DM → open plugin Settings →
 * fill the form and tap Inject.
 */

import { findByProps, findByStoreName } from "@vendetta/metro";
import { React, ReactNative } from "@vendetta/metro/common";
import { storage } from "@vendetta/plugin";
import { useProxy } from "@vendetta/storage";
import { Forms, General } from "@vendetta/ui/components";
import { showToast } from "@vendetta/ui/toasts";

const { View, TextInput, ScrollView, TouchableOpacity, Text, StyleSheet } = ReactNative;
const { FormSection, FormRow, FormSwitch, FormDivider, FormInput, FormText } = Forms;

// ─── Metro modules ───────────────────────────────────────────────────────────
const FluxDispatcher = findByProps("dispatch", "subscribe");
const UserStore = findByStoreName("UserStore");
const ChannelStore = findByStoreName("ChannelStore");
const SelectedChannelStore = findByStoreName("SelectedChannelStore");

// ─── Snowflake helpers ───────────────────────────────────────────────────────
let _idCounter = 0;

function uniqueSnowflake(date: Date): string {
  const offset = _idCounter++ % 4096;
  const ms = Math.max(0, date.getTime() - 1420070400000);
  // BigInt may not be ideal everywhere; fall back to string math if needed
  try {
    return ((BigInt(ms) << 22n) | BigInt(offset)).toString();
  } catch {
    // Very rough fallback (not a real snowflake, but unique enough for local fakes)
    return `${date.getTime()}${offset}${Math.floor(Math.random() * 999)}`;
  }
}

function randomSeconds(date: Date): Date {
  const sec = 1 + Math.floor(Math.random() * 59);
  return new Date(date.getTime() + sec * 1000);
}

// ─── Persistence ─────────────────────────────────────────────────────────────
const STORAGE_KEY = "fakes";

interface PersistedMessage {
  type: "message";
  channelId: string;
  authorId: string;
  content: string;
  timestamp: string;
  snowflakeId: string;
}

interface PersistedCall {
  type: "call";
  channelId: string;
  callerId: string;
  otherId: string;
  missed: boolean;
  durationSec: number;
  timestamp: string;
  endedTimestamp: string | null;
  snowflakeId: string;
}

type PersistedFake = PersistedMessage | PersistedCall;

function loadPersisted(): PersistedFake[] {
  try {
    const raw = storage[STORAGE_KEY];
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function savePersisted(fakes: PersistedFake[]) {
  try {
    storage[STORAGE_KEY] = fakes;
  } catch {}
}

function removePersisted(channelId: string, ids: Set<string>) {
  const fakes = loadPersisted().filter(
    (f) => !(f.channelId === channelId && ids.has(f.snowflakeId))
  );
  savePersisted(fakes);
}

// ─── Fake ID tracking ────────────────────────────────────────────────────────
const fakeIds = new Map<string, Set<string>>();

function registerFake(channelId: string, id: string) {
  if (!fakeIds.has(channelId)) fakeIds.set(channelId, new Set());
  fakeIds.get(channelId)!.add(id);
}

function clearFakes(channelId: string): number {
  const ids = fakeIds.get(channelId);
  if (!ids?.size) return 0;
  let n = 0;
  for (const id of ids) {
    FluxDispatcher.dispatch({
      type: "MESSAGE_DELETE",
      channelId,
      id,
      mlDeleted: true,
    });
    n++;
  }
  removePersisted(channelId, ids);
  ids.clear();
  return n;
}

// ─── Channel / user helpers ──────────────────────────────────────────────────
function getCurrentDMChannel(): any | null {
  try {
    const chId = SelectedChannelStore.getChannelId?.();
    if (!chId) return null;
    const ch = ChannelStore.getChannel?.(chId);
    if (!ch || (ch.type !== 1 && ch.type !== 3)) return null;
    return ch;
  } catch {
    return null;
  }
}

function getChannelMembers(): any[] {
  try {
    const ch = getCurrentDMChannel();
    if (!ch) return [];
    const me = UserStore.getCurrentUser?.();
    const ids: string[] =
      ch.recipients ?? ch.rawRecipients?.map((r: any) => r.id) ?? [];
    const members: any[] = [];
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

function buildAuthor(user: any) {
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
    avatar_decoration_data: user.avatarDecorationData
      ? {
          asset: user.avatarDecorationData.asset,
          sku_id: user.avatarDecorationData.skuId,
        }
      : null,
    banner_color: null,
  };
}

// ─── Injection ───────────────────────────────────────────────────────────────
function inject(
  channelId: string,
  author: any,
  content: string,
  date: Date,
  persistedId?: string
) {
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
      type: 0,
    },
    optimistic: false,
    isPushNotification: false,
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
      snowflakeId: id,
    });
    savePersisted(fakes);
  }
}

function injectCall(
  channelId: string,
  caller: any,
  other: any,
  missed: boolean,
  durationSec: number,
  date: Date,
  persistedId?: string,
  persistedEndedTs?: string | null
) {
  const actualDate = persistedId ? date : randomSeconds(date);
  const id = persistedId ?? uniqueSnowflake(actualDate);
  const participants = missed ? [caller.id] : [caller.id, other.id];
  const endedDate = missed
    ? actualDate
    : persistedEndedTs
      ? new Date(persistedEndedTs)
      : new Date(actualDate.getTime() + durationSec * 1000);

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
      type: 3, // CALL
      call: {
        participants,
        ended_timestamp: endedDate.toISOString(),
        duration: missed ? undefined : durationSec,
      },
    },
    optimistic: false,
    isPushNotification: false,
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
      snowflakeId: id,
    });
    savePersisted(fakes);
  }
}

// ─── Restore on load ─────────────────────────────────────────────────────────
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

// ─── Settings UI ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, paddingBottom: 40 },
  hint: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    opacity: 0.6,
    fontSize: 13,
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginVertical: 4,
    color: "#fff",
    fontSize: 15,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  chipActive: {
    backgroundColor: "#5865f2",
  },
  chipText: { color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: "600" },
  chipTextActive: { color: "#fff" },
  btn: {
    marginHorizontal: 16,
    marginVertical: 6,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
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
    opacity: 0.45,
  },
});

function memberLabel(u: any) {
  return u?.globalName || u?.username || u?.id || "?";
}

function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function Settings() {
  useProxy(storage);

  const me = UserStore.getCurrentUser?.();
  const ch = getCurrentDMChannel();
  const channelId = SelectedChannelStore.getChannelId?.();
  const members = getChannelMembers();
  const isInDM = !!ch;

  const [mode, setMode] = React.useState<"message" | "call">("message");
  const [text, setText] = React.useState("");
  const [senderId, setSenderId] = React.useState(me?.id ?? "");
  const [callerId, setCallerId] = React.useState(me?.id ?? "");
  const [receiverId, setReceiverId] = React.useState(
    () => members.find((m) => m.id !== me?.id)?.id ?? me?.id ?? ""
  );
  const [missed, setMissed] = React.useState(false);
  const [durationMin, setDurationMin] = React.useState("5");
  const [dateStr, setDateStr] = React.useState(() => toLocalInput(new Date()));

  // Keep defaults in sync when channel changes
  React.useEffect(() => {
    if (me?.id) {
      setSenderId(me.id);
      setCallerId(me.id);
    }
    const other = members.find((m) => m.id !== me?.id);
    if (other) setReceiverId(other.id);
  }, [channelId]);

  function handleInjectMessage() {
    if (!isInDM || !channelId) {
      showToast("Open a DM or group DM first", 1);
      return;
    }
    if (!text.trim()) {
      showToast("Enter a message", 1);
      return;
    }
    const author = members.find((m) => m.id === senderId) ?? me;
    if (!author) return;
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      showToast("Invalid date", 1);
      return;
    }
    inject(channelId, author, text.trim(), date);
    setText("");
    setDateStr(toLocalInput(new Date(date.getTime() + 60_000)));
    showToast("Message injected ✓", 0);
  }

  function handleInjectCall() {
    if (!isInDM || !channelId) {
      showToast("Open a DM or group DM first", 1);
      return;
    }
    const caller = members.find((m) => m.id === callerId);
    const receiver = members.find((m) => m.id === receiverId);
    if (!caller || !receiver) {
      showToast("Pick caller & receiver", 1);
      return;
    }
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      showToast("Invalid date", 1);
      return;
    }
    const durSec = missed ? 0 : Math.max(1, Math.round((parseFloat(durationMin) || 0) * 60));
    injectCall(channelId, caller, receiver, missed, durSec, date);
    setDateStr(toLocalInput(new Date(date.getTime() + 60_000)));
    showToast(missed ? "Missed call injected ✓" : "Call injected ✓", 0);
  }

  function handleClear() {
    if (!channelId) return;
    const n = clearFakes(channelId);
    showToast(`${n} fake${n !== 1 ? "s" : ""} deleted`, 0);
  }

  if (!isInDM) {
    return (
      <ScrollView style={styles.container}>
        <Text style={styles.hint}>
          Open a DM or group DM, then come back here to inject fake messages or calls for screenshots.
        </Text>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.hint}>
        Current channel: {ch?.name || ch?.id || "DM"} · fakes are local only
      </Text>

      {/* Mode tabs */}
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.chip, mode === "message" && styles.chipActive]}
          onPress={() => setMode("message")}
        >
          <Text style={[styles.chipText, mode === "message" && styles.chipTextActive]}>
            💬 Message
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.chip, mode === "call" && styles.chipActive]}
          onPress={() => setMode("call")}
        >
          <Text style={[styles.chipText, mode === "call" && styles.chipTextActive]}>
            📞 Call
          </Text>
        </TouchableOpacity>
      </View>

      {/* Date */}
      <Text style={styles.sectionTitle}>Date / time (local)</Text>
      <TextInput
        style={styles.input}
        value={dateStr}
        onChangeText={setDateStr}
        placeholder="YYYY-MM-DDTHH:mm"
        placeholderTextColor="rgba(255,255,255,0.3)"
        autoCapitalize="none"
        autoCorrect={false}
      />
      <View style={styles.row}>
        <TouchableOpacity
          style={styles.chip}
          onPress={() => setDateStr(toLocalInput(new Date()))}
        >
          <Text style={styles.chipText}>Now</Text>
        </TouchableOpacity>
      </View>

      {mode === "message" ? (
        <>
          <Text style={styles.sectionTitle}>From</Text>
          <View style={styles.row}>
            {members.map((m) => (
              <TouchableOpacity
                key={m.id}
                style={[styles.chip, senderId === m.id && styles.chipActive]}
                onPress={() => setSenderId(m.id)}
              >
                <Text
                  style={[
                    styles.chipText,
                    senderId === m.id && styles.chipTextActive,
                  ]}
                >
                  {memberLabel(m)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.sectionTitle}>Message</Text>
          <TextInput
            style={[styles.input, { minHeight: 72, textAlignVertical: "top" }]}
            value={text}
            onChangeText={setText}
            placeholder="Message content…"
            placeholderTextColor="rgba(255,255,255,0.3)"
            multiline
          />

          <TouchableOpacity
            style={[styles.btn, styles.btnPrimary]}
            onPress={handleInjectMessage}
          >
            <Text style={styles.btnText}>Inject Message</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={styles.sectionTitle}>Caller</Text>
          <View style={styles.row}>
            {members.map((m) => (
              <TouchableOpacity
                key={m.id}
                style={[styles.chip, callerId === m.id && styles.chipActive]}
                onPress={() => setCallerId(m.id)}
              >
                <Text
                  style={[
                    styles.chipText,
                    callerId === m.id && styles.chipTextActive,
                  ]}
                >
                  {memberLabel(m)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.sectionTitle}>Receiver</Text>
          <View style={styles.row}>
            {members.map((m) => (
              <TouchableOpacity
                key={m.id}
                style={[styles.chip, receiverId === m.id && styles.chipActive]}
                onPress={() => setReceiverId(m.id)}
              >
                <Text
                  style={[
                    styles.chipText,
                    receiverId === m.id && styles.chipTextActive,
                  ]}
                >
                  {memberLabel(m)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.sectionTitle}>Call type</Text>
          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.chip, !missed && styles.chipActive]}
              onPress={() => setMissed(false)}
            >
              <Text style={[styles.chipText, !missed && styles.chipTextActive]}>
                ✅ Answered
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.chip, missed && { backgroundColor: "#ed4245" }]}
              onPress={() => setMissed(true)}
            >
              <Text style={[styles.chipText, missed && styles.chipTextActive]}>
                ❌ Missed
              </Text>
            </TouchableOpacity>
          </View>

          {!missed && (
            <>
              <Text style={styles.sectionTitle}>Duration (minutes)</Text>
              <TextInput
                style={styles.input}
                value={durationMin}
                onChangeText={setDurationMin}
                keyboardType="numeric"
                placeholder="5"
                placeholderTextColor="rgba(255,255,255,0.3)"
              />
            </>
          )}

          <TouchableOpacity
            style={[styles.btn, styles.btnPrimary]}
            onPress={handleInjectCall}
          >
            <Text style={styles.btnText}>Inject Call</Text>
          </TouchableOpacity>
        </>
      )}

      <TouchableOpacity style={[styles.btn, styles.btnDanger]} onPress={handleClear}>
        <Text style={styles.btnTextDanger}>🗑 Clear fakes in this channel</Text>
      </TouchableOpacity>

      <Text style={[styles.hint, { marginTop: 12 }]}>
        Tip: inject a few messages with different timestamps, then take your screenshot.
        Clear removes only the fakes created by this plugin in the current channel.
      </Text>
    </ScrollView>
  );
}

// ─── Lifecycle ───────────────────────────────────────────────────────────────
let restoreTimer: any = null;
let connectionHandler: (() => void) | null = null;

export const onLoad = () => {
  // Restore after Discord finishes connecting
  connectionHandler = () => {
    if (connectionHandler) {
      try {
        FluxDispatcher.unsubscribe?.("CONNECTION_OPEN", connectionHandler);
      } catch {}
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
    // If already connected, just restore after a short delay
    restoreTimer = setTimeout(doRestore, 1500);
  }
};

export const onUnload = () => {
  if (connectionHandler) {
    try {
      FluxDispatcher.unsubscribe?.("CONNECTION_OPEN", connectionHandler);
    } catch {}
    connectionHandler = null;
  }
  if (restoreTimer) {
    clearTimeout(restoreTimer);
    restoreTimer = null;
  }
  // Do not clear fakes from the UI on unload — they stay until user clears
  // or disables persistence. We only stop tracking new ones.
  fakeIds.clear();
  _idCounter = 0;
};

export const settings = Settings;
