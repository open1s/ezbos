import { BrainOS, Content, ContentPart, version } from '../src/index.js';
import { ConfigLoader } from '@open1s/jsbos';

const CAT_IMAGE = 'https://download.catpng.net/silver_tabby_cat_on_gray_pillow_beside_clear_glass_window-thumbnail.png';

function loadGoogleConfig() {
  const loader = new ConfigLoader();
  loader.discover();
  const config = JSON.parse(loader.loadSync());
  const googleModel = config?.llm?.google || {};
  return {
    model: googleModel.model || 'nvidia/nvidia/nemotron-3-nano-omni-30b-a3b-reasoning',
    baseUrl: googleModel.base_url || 'http://127.0.0.1:11436/v1',
    apiKey: googleModel.api_key || '',
  };
}

async function main() {
  console.log(`\n=== 10-multimodal.ts - Multimodal Content Demo (v${version()}) ===\n`);

  const googleConfig = loadGoogleConfig();
  console.log(`Using model: ${googleConfig.model}`);
  const brain = new BrainOS({ model: googleConfig.model, baseUrl: googleConfig.baseUrl, apiKey: googleConfig.apiKey });
  await brain.start();

  console.log('--- Text-only content (backward compatible) ---');
  const textAgent = await brain.agent('text-demo').start();
  const textResult = await textAgent.ask('What is 2 + 2?');
  console.log('Text result:', textResult.trim());
  await textAgent.close();

  console.log('\n--- Content.text() helper ---');
  const textContentAgent = await brain.agent('text-content-demo').start();
  const content = Content.text('What is 3 + 3?');
  const contentResult = await textContentAgent.ask(content);
  console.log('Content.text result:', contentResult.trim());
  await textContentAgent.close();

  console.log('\n--- Content.parts() with image URL ---');
  const imageAgent = await brain.agent('image-demo').start();
  const imageContent = Content.parts([
    ContentPart.text('What do you see in this image?'),
    ContentPart.image(CAT_IMAGE),
  ]);
  console.log('Sending image content...');
  const imageResult = await imageAgent.ask(imageContent);
  console.log('Image result:', imageResult.slice(0, 200) + (imageResult.length > 200 ? '...' : ''));
  await imageAgent.close();

  console.log('\n--- Content.image() shorthand ---');
  const shorthandAgent = await brain.agent('shorthand-demo').start();
  const shorthandContent = Content.image(CAT_IMAGE);
  const shorthandResult = await shorthandAgent.ask(shorthandContent);
  console.log('Shorthand result:', shorthandResult.slice(0, 200) + (shorthandResult.length > 200 ? '...' : ''));
  await shorthandAgent.close();

  console.log('\n--- stream() with multimodal content ---');
  const streamAgent = await brain.agent('stream-demo').start();
  console.log('Streaming image result:');
  const streamContent = Content.parts([
    ContentPart.text('Describe this image briefly.'),
    ContentPart.image(CAT_IMAGE),
  ]);
  await streamAgent.stream(streamContent, (token: any) => {
    if (token.type === 'Text') process.stdout.write(token.text);
    if (token.type === 'ReasoningContent') process.stdout.write(token.text);
  });
  console.log('\n');
  await streamAgent.close();

  console.log('\n--- streamCollect() with multimodal content ---');
  const collectAgent = await brain.agent('collect-demo').start();
  const collectContent = Content.image(CAT_IMAGE);
  const tokens = await collectAgent.streamCollect(collectContent);
  const textTokens = tokens.filter((t: any) => t.text);
  console.log('Collected', tokens.length, 'tokens,', textTokens.length, 'with text');
  console.log('Text:', textTokens.map((t: any) => t.text).join(''));
  await collectAgent.close();

  await brain.stop();
  console.log('\nDone.');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });