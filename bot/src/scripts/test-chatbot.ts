import { handleIncomingMessage } from "../flows/orderFlow.js";
import { initFirebase, isFirebaseEnabled } from "../firebase/admin.js";
import { loadMenu, getMenu } from "../menu/data.js";
import { sendTextMessage } from "../openwa/client.js";
import { loadRestaurantProfile, getRestaurantProfile } from "../restaurant/profile.js";

const TEST_CHAT = "51933240664@c.us"; // Admin — recibe la prueba en su WhatsApp

async function run(): Promise<void> {
  if (!isFirebaseEnabled()) {
    console.error("Firebase no está activo");
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
  console.log(`Carta Firebase: ${menu.categories.length} categorías, ${totalItems} platos\n`);

  const steps: Array<{ label: string; text: string }> = [
    { label: "Hola → menú principal", text: "Hola" },
    { label: "1 → carta completa", text: "1" },
    { label: "2 → iniciar pedido", text: "2" },
    { label: "1 → categoría Ceviches", text: "1" },
  ];

  for (const step of steps) {
    const reply = await handleIncomingMessage(TEST_CHAT, step.text, "Prueba Bot");
    console.log(`--- ${step.label} ---`);
    console.log(reply.slice(0, 500) + (reply.length > 500 ? "...\n" : "\n"));

    await sendTextMessage(TEST_CHAT, `[PRUEBA] ${step.label}\n\n${reply}`);
    console.log(`✓ Enviado a WhatsApp ${TEST_CHAT}\n`);
    await sleep(1500);
  }

  console.log("Prueba completa. Revisa WhatsApp del admin (933240664).");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

run().catch((error) => {
  console.error("Error en prueba:", error);
  process.exit(1);
});
