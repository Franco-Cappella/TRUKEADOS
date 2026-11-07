// 'cloudflare:workers' de mentira: alcanza con que DurableObject guarde ctx y env.
export class DurableObject {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
  }
}
