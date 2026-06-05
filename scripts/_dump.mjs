import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const sv = await prisma.simulationVersion.findFirst({ where: { simulationId: 'cmpxs9p0z000110z66l2uluzh' }, orderBy: { createdAt: 'desc' } });
if (sv) {
  const p = sv.payloadJson;
  const e = p.electricity;
  console.log('consumo:', JSON.stringify(e?.consumo));
  console.log('potencia:', JSON.stringify(e?.potenciaContratada));
  console.log('tarifaAcceso:', e?.tarifaAcceso);
  console.log('periodo:', JSON.stringify(e?.periodo));
  console.log('facturaActual:', e?.facturaActual);
  console.log('omieEstimado:', JSON.stringify(e?.omieEstimado));
  console.log('personalizadaOmieB:', JSON.stringify(e?.personalizadaOmieB));
  console.log('personalizadaIndex:', JSON.stringify(e?.personalizadaIndex));
  console.log('extras:', JSON.stringify(e?.extras));
}
await prisma.$disconnect();
