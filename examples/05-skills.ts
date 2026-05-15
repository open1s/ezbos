import { BrainOS, defineSkill, SkillsBuilder, version } from '../src/index.js';

async function main() {
  console.log(`\n=== 05-skills.ts - Skills API Demo (v${version()}) ===\n`);

  console.log('--- defineSkill ---');
  const skill = defineSkill('my-skill', 'You are a math expert. Always show your work.');
  console.log('Skill:', skill);

  console.log('\n--- SkillsBuilder ---');
  const builder = new SkillsBuilder()
    .from_dir('./my-skills-dir')
    .add('code-review', 'You are a code reviewer. Be thorough.')
    .add('api-design', 'You are an API designer. Follow REST best practices.');

  const built = builder.build();
  console.log('Built skills:', built);
  console.log('  dirs:', built.dirs);
  console.log('  inline:', built.inline.map(s => s.name));

  const brain = new BrainOS();
  await brain.start();

  console.log('\n--- Agent with tools (skills loaded from dir in real usage) ---');
  const agent = brain.agent('skills-demo')
    .with_tools()
    .with_skills_dir('./skills');

  const started = await agent.start();
  console.log('Agent started with skills_dir configured');
  console.log('Agent tools:', started.tools);
  console.log('Agent config:', started.config);

  await started.close();
  await brain.stop();
  console.log('\nDone.');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });