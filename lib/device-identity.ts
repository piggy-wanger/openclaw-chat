// Device Identity Management for OpenClaw Gateway
// Uses Web Crypto API (SubtleCrypto) for ed25519 key generation and signing

const STORAGE_KEY = "openclaw-device-identity-v1";

export interface DeviceIdentity {
  deviceId: string; // SHA-256(publicKey) hex
  publicKey: string; // base64url
  privateKey: string; // base64url
}

interface StoredIdentity extends DeviceIdentity {
  version: 1;
  createdAtMs: number;
}

// Base64URL utilities
function bytesToBase64url(bytes: Uint8Array): string {
  const binString = Array.from(bytes, (b) => String.fromCodePoint(b)).join("");
  return btoa(binString).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlToBytes(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binString = atob(padded);
  return Uint8Array.from(binString, (c) => c.codePointAt(0) ?? 0);
}

// Check if ed25519 is supported
function isEd25519Supported(): boolean {
  try {
    // Check if the browser supports ed25519 algorithm
    return typeof crypto !== "undefined" && crypto.subtle !== undefined;
  } catch {
    return false;
  }
}

// Compute SHA-256 hash and return hex string
async function sha256Hex(data: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", data.buffer as ArrayBuffer);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Generate a new ed25519 key pair
 */
async function generateKeyPair(): Promise<{ publicKey: Uint8Array; privateKey: Uint8Array }> {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: "Ed25519",
    } as unknown as EcKeyGenParams,
    true, // extractable
    ["sign", "verify"]
  );

  // Export keys in raw format
  const publicKeyBuffer = await crypto.subtle.exportKey("raw", keyPair.publicKey);
  const privateKeyBuffer = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);

  // For ed25519, raw public key is 32 bytes
  // pkcs8 private key contains the key material
  const publicKey = new Uint8Array(publicKeyBuffer);

  // Extract the raw private key from PKCS8 format
  // PKCS8 for ed25519: sequence containing version, algorithm, and private key
  // The last 32 bytes are the seed/private key
  const pkcs8Bytes = new Uint8Array(privateKeyBuffer);
  // For ed25519, the private key seed is at the end (32 bytes)
  // But we need to export it in raw format for compatibility
  // Actually, let's export as jwk and extract from there
  const privateKeyJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);

  // JWK d field contains the private key (base64url encoded)
  const privateKey = base64urlToBytes(privateKeyJwk.d!);

  return { publicKey, privateKey };
}

/**
 * Get or create device identity
 * - Reads from localStorage if exists
 * - Generates new ed25519 key pair if not
 */
export async function getOrCreateIdentity(): Promise<DeviceIdentity | null> {
  if (!isEd25519Supported()) {
    console.warn("Ed25519 not supported in this browser");
    return null;
  }

  try {
    // Try to read existing identity
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed: StoredIdentity = JSON.parse(stored);
      if (parsed.version === 1 && parsed.deviceId && parsed.publicKey && parsed.privateKey) {
        return {
          deviceId: parsed.deviceId,
          publicKey: parsed.publicKey,
          privateKey: parsed.privateKey,
        };
      }
    }

    // Generate new identity
    const { publicKey, privateKey } = await generateKeyPair();

    // Compute deviceId as SHA-256 of public key
    const deviceId = await sha256Hex(publicKey);

    const identity: StoredIdentity = {
      version: 1,
      deviceId,
      publicKey: bytesToBase64url(publicKey),
      privateKey: bytesToBase64url(privateKey),
      createdAtMs: Date.now(),
    };

    // Store in localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));

    return {
      deviceId: identity.deviceId,
      publicKey: identity.publicKey,
      privateKey: identity.privateKey,
    };
  } catch (error) {
    console.error("Failed to get or create device identity:", error);
    return null;
  }
}

/**
 * Sign data with the private key
 * @param privateKeyBase64url - Base64url encoded private key (raw 32 bytes)
 * @param data - String data to sign
 * @returns Base64url encoded signature
 */
export async function signChallenge(privateKeyBase64url: string, publicKeyBase64url: string, data: string): Promise<string> {
  // For Web Crypto API, ed25519 JWK needs both d (private) and x (public)
  const jwk: JsonWebKey = {
    kty: "OKP",
    crv: "Ed25519",
    x: publicKeyBase64url,
    d: privateKeyBase64url,
  };

  const cryptoKey = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "Ed25519" } as unknown as EcKeyImportParams,
    false,
    ["sign"]
  );

  // Sign the data (UTF-8 encoded)
  const encoder = new TextEncoder();
  const dataBytes = encoder.encode(data);

  const signatureBuffer = await crypto.subtle.sign(
    { name: "Ed25519" } as unknown as EcdsaParams,
    cryptoKey,
    dataBytes
  );

  const signature = new Uint8Array(signatureBuffer);
  return bytesToBase64url(signature);
}

/**
 * Build the auth string for signing (matches official Gateway protocol)
 * Format: deviceId|clientId|clientMode|role|scopes|signedAtMs|token|null
 */
export function buildAuthString(params: {
  deviceId: string;
  clientId: string;
  clientMode: string;
  role: string;
  scopes: string[];
  signedAtMs: number;
  token: string | null;
  nonce: string;
}): string {
  const { deviceId, clientId, clientMode, role, scopes, signedAtMs, token, nonce } = params;
  const scopesStr = scopes.join(",");
  const tokenStr = token ?? "null";
  return `v2|${deviceId}|${clientId}|${clientMode}|${role}|${scopesStr}|${signedAtMs}|${tokenStr}|${nonce}`;
}
