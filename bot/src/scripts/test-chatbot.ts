/**
 * Prueba end-to-end del flujo de pedido (sin WhatsApp real).
 *
 * Uso:
 *   npm run test:chatbot              → solo consola + aserciones
 *   npm run test:chatbot:notify      → además envía resumen al admin por WhatsApp
 *
 * Variables:
 *   TEST_CHAT_ID     chatId simulado (default: 51999000001@c.us)
 *   NOTIFY_WHATSAPP=1  envía resumen al admin al finalizar
 */
import { handleIncomingMessage } from "../flows/orderFlow.js";
import { initFirebase, isFirebaseEnabled } from "../firebase/admin.js";
import { loadMenu, getMenu } from "../menu/data.js";
import { sendTextMessage } from "../openwa/client.js";
import {
  loadRestaurantProfile,
  getRestaurantProfile,
} from "../restaurant/profile.js";
import { config } from "../config.js";

const TEST_CHAT =
  process.env.TEST_CHAT_ID?.trim() || "51999000001@c.us";
const NOTIFY = process.env.NOTIFY_WHATSAPP === "1";
const TEST_NAME = "Prueba Automática";

interface Step {
  label: string;
  text: string;
  expect: (reply: string) => void;
}

function assertIncludes(reply: string, fragment: string, step: string): void {
  if (!reply.toLowerCase().includes(fragment.toLowerCase())) {
    throw new Error(
      `[${step}] Se esperaba "${fragment}" en la respuesta:\n${reply.slice(0, 600)}`,
    );
  }
}

async function send(text: string): Promise<string> {
  return handleIncomingMessage(TEST_CHAT, text, TEST_NAME);
}

async function runStep(
  step: Step,
  log: string[],
): Promise<void> {
  const reply = await send(step.text);
  step.expect(reply);
  const preview =
    reply.length > 280 ? `${reply.slice(0, 280)}…` : reply;
  console.log(`✓ ${step.label}`);
  console.log(`  → ${preview.replace(/\n/g, " ")}\n`);
  log.push(`✓ ${step.label}`);
}

async function run(): Promise<void> {
  if (!isFirebaseEnabled()) {
    console.error("Firebase no está activo — configura firebase-service-account.json");
    process.exit(1);
  }

  await initFirebase();
  await loadRestaurantProfile();
  await loadMenu();

  const profile = getRestaurantProfile();
  const menu = getMenu();
  const totalItems = menu.categories.reduce(
    (sum, cat) => sum + cat.items.length,
    0,
  );

  console.log(`Restaurante: ${profile.name}`);
  console.log(`Carta: ${menu.categories.length} categorías, ${totalItems} platos`);
  console.log(`Chat de prueba: ${TEST_CHAT}\n`);

  const log: string[] = [];
  let passed = 0;

  const holaReply = await send("Hola");
  if (holaReply.includes("registrarte")) {
    console.log("✓ Hola → aviso de registro");
    console.log(`  → ${holaReply.slice(0, 120).replace(/\n/g, " ")}\n`);
    log.push("✓ Hola → aviso de registro");
    passed += 1;

    await runStep(
      {
        label: "2 → omitir registro",
        text: "2",
        expect: (r) => assertIncludes(r, "Bienvenido", "menú principal"),
      },
      log,
    );
    passed += 1;
  } else {
    assertIncludes(holaReply, "Bienvenido", "menú principal");
    console.log("✓ Hola → menú principal (cliente ya conocido)");
    console.log(`  → ${holaReply.slice(0, 120).replace(/\n/g, " ")}\n`);
    log.push("✓ Hola → menú principal");
    passed += 1;
  }

  const orderSteps: Step[] = [
    {
      label: "2 → iniciar pedido",
      text: "2",
      expect: (r) => assertIncludes(r, "categoría", "iniciar pedido"),
    },
    {
      label: "1 → primera categoría",
      text: "1",
      expect: (r) => assertIncludes(r, "S/", "lista de platos"),
    },
    {
      label: "1 → primer plato",
      text: "1",
      expect: (r) => assertIncludes(r, "Cuántos", "cantidad"),
    },
    {
      label: "1 → cantidad",
      text: "1",
      expect: (r) => assertIncludes(r, "Agregado", "post-agregar"),
    },
    {
      label: "2 → continuar con pedido",
      text: "2",
      expect: (r) => assertIncludes(r, "recibes", "entrega"),
    },
    {
      label: "2 → recoger en local",
      text: "2",
      expect: (r) => assertIncludes(r, "pagar", "pago"),
    },
    {
      label: "1 → Yape",
      text: "1",
      expect: (r) => assertIncludes(r, "Confirma", "confirmación"),
    },
    {
      label: "si → confirmar pedido",
      text: "si",
      expect: (r) => assertIncludes(r, "registrado", "pedido confirmado"),
    },
  ];

  for (const step of orderSteps) {
    await runStep(step, log);
    passed += 1;
  }

  console.log(`\n${passed} pasos OK — flujo completo verificado.`);

  if (NOTIFY) {
    const adminChat = config.restaurant.adminWhatsAppId;
    const summary = [
      "🧪 *Prueba automática del bot*",
      "",
      `Restaurante: ${profile.name}`,
      `Pasos: ${passed} OK`,
      "",
      ...log,
      "",
      "_Pedido de prueba creado desde chat simulado._",
    ].join("\n");

    await sendTextMessage(adminChat, summary);
    console.log(`Resumen enviado a WhatsApp ${adminChat}`);
  } else {
    console.log(
      "Tip: npm run test:chatbot:notify — envía resumen al admin.",
    );
  }
}

run().catch((error) => {
  console.error("\n❌ Prueba fallida:", error instanceof Error ? error.message : error);
  process.exit(1);
});
