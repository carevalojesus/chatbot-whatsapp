import {
  addAddress,
  deleteAddress,
  getCustomer,
  getCustomerByChatId,
  getOrCreateCustomer,
  listAddresses,
  MAX_ADDRESSES,
  setRegistrationSkipped,
  updateCustomerName,
} from "../customers/index.js";
import type { UserSession } from "../session/types.js";
import { normalizeText, parseChoice } from "../utils/format.js";

export function buildRegistrationPrompt(whatsappName?: string): string {
  const nameHint = whatsappName
    ? `\n\n_Tu nombre en WhatsApp es *${whatsappName}* — puedes usarlo al registrarte._`
    : "";

  return `👋 *¿Quieres registrarte como cliente?*

Guardamos tu nombre y direcciones para pedir más rápido la próxima vez.${nameHint}

1️⃣ Sí, registrarme
2️⃣ No, continuar sin registro

Puedes registrarte después en *Mi perfil* (opción 4).`;
}

export async function shouldPromptRegistration(
  chatId: string,
): Promise<boolean> {
  const customer = await getCustomerByChatId(chatId);
  if (!customer) return true;
  if (customer.registrationSkipped) return false;
  if (customer.name.trim()) return false;
  return true;
}

export async function ensureSessionCustomer(
  session: UserSession,
): Promise<string> {
  if (session.customerId) {
    return session.customerId;
  }

  const customer = await getOrCreateCustomer(session.chatId);
  session.customerId = customer.id;
  if (customer.name) {
    session.customerName = customer.name;
  }
  return customer.id;
}

export async function handleRegistrationFlow(
  session: UserSession,
  text: string,
): Promise<{ reply: string; done: boolean; continueOrder?: boolean }> {
  const normalized = normalizeText(text);

  switch (session.state) {
    case "register_prompt":
      return handleRegisterPrompt(session, text, normalized);
    case "register_name":
      return handleRegisterName(session, text, normalized);
    default:
      session.state = "register_prompt";
      return {
        reply: buildRegistrationPrompt(session.whatsappName),
        done: false,
      };
  }
}

async function handleRegisterPrompt(
  session: UserSession,
  text: string,
  normalized: string,
): Promise<{ reply: string; done: boolean; continueOrder?: boolean }> {
  if (normalized === "0") {
    session.state = "main_menu";
    session.pendingAction = undefined;
    return { reply: "", done: true };
  }

  const choice = parseChoice(text, 2);
  if (!choice) {
    return {
      reply: `Opción inválida.\n\n${buildRegistrationPrompt(session.whatsappName)}`,
      done: false,
    };
  }

  if (choice === 1) {
    session.state = "register_name";
    const whatsappHint = session.whatsappName
      ? `\n\nO escribe *1* para usar *${session.whatsappName}* (nombre de WhatsApp).`
      : "";
    return {
      reply: `✏️ Escribe tu *nombre* para registrarte:${whatsappHint}`,
      done: false,
    };
  }

  const customer = await getOrCreateCustomer(session.chatId);
  await setRegistrationSkipped(customer.id);
  session.customerId = customer.id;

  const continueOrder = session.pendingAction === "order";
  session.pendingAction = undefined;
  session.state = "main_menu";

  return {
    reply: continueOrder
      ? ""
      : "Entendido. Puedes pedir sin registro o registrarte en *Mi perfil* (opción 4).",
    done: !continueOrder,
    continueOrder,
  };
}

async function handleRegisterName(
  session: UserSession,
  text: string,
  normalized: string,
): Promise<{ reply: string; done: boolean; continueOrder?: boolean }> {
  if (normalized === "0") {
    session.state = "register_prompt";
    return {
      reply: buildRegistrationPrompt(session.whatsappName),
      done: false,
    };
  }

  let name = text.trim();
  if (normalized === "1" && session.whatsappName) {
    name = session.whatsappName;
  }

  if (name.length < 2) {
    return {
      reply: "Escribe un nombre válido (mínimo 2 caracteres).",
      done: false,
    };
  }

  const customerId = await ensureSessionCustomer(session);
  await updateCustomerName(customerId, name);
  session.customerName = name;

  const continueOrder = session.pendingAction === "order";
  session.pendingAction = undefined;
  session.state = "main_menu";

  return {
    reply: `✅ *¡Registro completado!*\n\nHola, *${name}*. Tus datos quedaron guardados.`,
    done: !continueOrder,
    continueOrder,
  };
}

export async function buildProfileMenu(session: UserSession): Promise<string> {
  const customerId = await ensureSessionCustomer(session);
  const customer = await getCustomer(customerId);
  const addresses = await listAddresses(customerId);

  const lines = [
    "👤 *Mi perfil*\n",
    `Nombre: *${customer?.name || "Sin registrar"}*`,
    `Pedidos realizados: ${customer?.orderCount ?? 0}`,
    "",
    "📍 *Direcciones guardadas:*",
  ];

  if (!addresses.length) {
    lines.push("_Aún no tienes direcciones guardadas._");
  } else {
    addresses.forEach((address, index) => {
      const mark = address.isDefault ? " ⭐" : "";
      lines.push(`${index + 1}. *${address.alias}*${mark} — ${address.line}`);
    });
  }

  lines.push(
    "",
    "1️⃣ Editar nombre",
    "2️⃣ Agregar dirección",
    addresses.length ? "3️⃣ Eliminar dirección" : "",
    "0️⃣ Volver al menú",
  );

  return lines.filter(Boolean).join("\n");
}

export async function handleProfileFlow(
  session: UserSession,
  text: string,
): Promise<{ reply: string; done: boolean }> {
  const normalized = normalizeText(text);

  switch (session.state) {
    case "profile_menu":
      return handleProfileMenu(session, text, normalized);
    case "edit_name":
      return handleEditName(session, text, normalized);
    case "address_menu":
      return handleAddressMenu(session, text, normalized);
    case "add_address_alias":
      return handleAddAddressAlias(session, text, normalized);
    case "add_address_line":
      return handleAddAddressLine(session, text);
    default:
      session.state = "profile_menu";
      return { reply: await buildProfileMenu(session), done: false };
  }
}

async function handleProfileMenu(
  session: UserSession,
  text: string,
  normalized: string,
): Promise<{ reply: string; done: boolean }> {
  if (normalized === "0") {
    session.state = "main_menu";
    return { reply: "", done: true };
  }

  const customerId = await ensureSessionCustomer(session);
  const addresses = await listAddresses(customerId);
  const maxChoice = addresses.length ? 3 : 2;
  const choice = parseChoice(text, maxChoice);

  if (!choice) {
    return { reply: `Opción inválida.\n\n${await buildProfileMenu(session)}`, done: false };
  }

  switch (choice) {
    case 1:
      session.state = "edit_name";
      return {
        reply: "✏️ Escribe tu *nombre* para registrarte:",
        done: false,
      };
    case 2:
      if (addresses.length >= MAX_ADDRESSES) {
        return {
          reply: `Ya tienes ${MAX_ADDRESSES} direcciones. Elimina una para agregar otra.\n\n${await buildProfileMenu(session)}`,
          done: false,
        };
      }
      session.state = "add_address_alias";
      return {
        reply: "📍 Escribe un *alias* para la dirección (ej: Casa, Trabajo, Oficina):",
        done: false,
      };
    case 3:
      session.state = "address_menu";
      return { reply: formatAddressDeleteMenu(addresses), done: false };
    default:
      return { reply: await buildProfileMenu(session), done: false };
  }
}

async function handleEditName(
  session: UserSession,
  text: string,
  normalized: string,
): Promise<{ reply: string; done: boolean }> {
  if (normalized === "0") {
    session.state = "profile_menu";
    return { reply: await buildProfileMenu(session), done: false };
  }

  const name = text.trim();
  if (name.length < 2) {
    return { reply: "Escribe un nombre válido (mínimo 2 caracteres).", done: false };
  }

  const customerId = await ensureSessionCustomer(session);
  await updateCustomerName(customerId, name);
  session.customerName = name;
  session.state = "profile_menu";

  return {
    reply: `✅ Nombre actualizado: *${name}*\n\n${await buildProfileMenu(session)}`,
    done: false,
  };
}

function formatAddressDeleteMenu(
  addresses: Awaited<ReturnType<typeof listAddresses>>,
): string {
  const lines = ["🗑️ *Eliminar dirección*\n"];
  addresses.forEach((address, index) => {
    lines.push(`${index + 1}. ${address.alias} — ${address.line}`);
  });
  lines.push("\nEscribe el *número* a eliminar o *0* para volver.");
  return lines.join("\n");
}

async function handleAddressMenu(
  session: UserSession,
  text: string,
  normalized: string,
): Promise<{ reply: string; done: boolean }> {
  if (normalized === "0") {
    session.state = "profile_menu";
    return { reply: await buildProfileMenu(session), done: false };
  }

  const customerId = await ensureSessionCustomer(session);
  const addresses = await listAddresses(customerId);
  const choice = parseChoice(text, addresses.length);

  if (!choice) {
    return {
      reply: `Opción inválida.\n\n${formatAddressDeleteMenu(addresses)}`,
      done: false,
    };
  }

  const target = addresses[choice - 1];
  await deleteAddress(customerId, target.id);
  session.state = "profile_menu";

  return {
    reply: `✅ Dirección *${target.alias}* eliminada.\n\n${await buildProfileMenu(session)}`,
    done: false,
  };
}

async function handleAddAddressAlias(
  session: UserSession,
  text: string,
  normalized: string,
): Promise<{ reply: string; done: boolean }> {
  if (normalized === "0") {
    session.state = "profile_menu";
    return { reply: await buildProfileMenu(session), done: false };
  }

  const alias = text.trim();
  if (alias.length < 2) {
    return { reply: "Escribe un alias válido (ej: Casa).", done: false };
  }

  session.pendingAddressAlias = alias;
  session.state = "add_address_line";

  return {
    reply: `📍 Alias *${alias}*\n\nAhora escribe la *dirección completa* (calle, distrito, referencia):`,
    done: false,
  };
}

async function handleAddAddressLine(
  session: UserSession,
  text: string,
): Promise<{ reply: string; done: boolean }> {
  const normalized = normalizeText(text);
  if (normalized === "0") {
    session.state = "profile_menu";
    session.pendingAddressAlias = undefined;
    session.pendingAddressLine = undefined;
    return { reply: await buildProfileMenu(session), done: false };
  }

  const line = text.trim();
  if (line.length < 8) {
    return {
      reply: "Escribe una dirección más completa (mínimo 8 caracteres).",
      done: false,
    };
  }

  const alias = session.pendingAddressAlias ?? "Otro";
  const customerId = await ensureSessionCustomer(session);

  try {
    await addAddress(customerId, alias, line);
  } catch (error) {
    if (error instanceof Error && error.message === "DUPLICATE_ALIAS") {
      return {
        reply: `Ya existe una dirección con alias *${alias}*. Elige otro alias.`,
        done: false,
      };
    }
    throw error;
  }

  session.pendingAddressAlias = undefined;
  session.pendingAddressLine = undefined;
  session.state = "profile_menu";

  return {
    reply: `✅ Dirección *${alias}* guardada.\n\n${await buildProfileMenu(session)}`,
    done: false,
  };
}

export async function formatSavedAddressChoice(
  customerId: string,
): Promise<string> {
  const addresses = await listAddresses(customerId);

  const lines = ["📍 *¿Dónde enviamos tu pedido?*\n"];
  addresses.forEach((address, index) => {
    lines.push(`${index + 1}. *${address.alias}* — ${address.line}`);
  });
  lines.push(`${addresses.length + 1}. Nueva dirección`);
  lines.push("\n*0* para volver.");
  return lines.join("\n");
}

export async function handleChooseSavedAddress(
  session: UserSession,
  text: string,
): Promise<string> {
  const normalized = normalizeText(text);
  if (normalized === "0") {
    session.state = "choose_delivery";
    return `🚚 ¿Cómo deseas recibir tu pedido?

1️⃣ Domicilio
2️⃣ Recoger en local

*0* para volver.`;
  }

  const customerId = await ensureSessionCustomer(session);
  const addresses = await listAddresses(customerId);
  const choice = parseChoice(text, addresses.length + 1);

  if (!choice) {
    return `Opción inválida.\n\n${await formatSavedAddressChoice(customerId)}`;
  }

  if (choice === addresses.length + 1) {
    session.state = "enter_address";
    return "📍 Escribe tu *nueva dirección* (calle, distrito, referencia):";
  }

  const selected = addresses[choice - 1];
  session.address = selected.line;
  session.addressAlias = selected.alias;
  session.state = "choose_payment";
  return "";
}
