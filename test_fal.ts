import { generateFal } from './lib/gemini';

async function test() {
  try {
      const res = await generateFal();
      console.log(res);
  } catch (e) {
      console.error(e);
  }
}
test();
