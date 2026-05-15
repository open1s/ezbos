export interface SkillDef {
  name: string;
  content: string;
}

export interface SkillDir {
  path: string;
}

export function defineSkill(name: string, content: string): SkillDef {
  return { name, content };
}

export class SkillsBuilder {
  private _dirs: string[] = [];
  private _skills: SkillDef[] = [];

  from_dir(path: string): this {
    this._dirs.push(path);
    return this;
  }

  add(name: string, content: string): this {
    this._skills.push({ name, content });
    return this;
  }

  build(): { dirs: string[], inline: SkillDef[] } {
    return { dirs: this._dirs, inline: this._skills };
  }
}