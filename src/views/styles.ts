export const adminStyles = `
body{font:16px system-ui;margin:0;background:#f4f4f5;color:#18181b}
main{max-width:1000px;margin:3rem auto;padding:0 1rem}
header,form{display:flex;gap:.6rem;align-items:center;flex-wrap:wrap}
header{justify-content:space-between}
h1{margin-bottom:.2rem}
section{background:#fff;padding:1rem;margin:1rem 0;border-radius:.5rem}
input,select,button{font:inherit;padding:.45rem}
input[name=destination]{min-width:22rem}
ul{list-style:none;padding:0}
li{display:flex;gap:.6rem;align-items:center;margin:.6rem 0}
small,time{color:#71717a;font-size:.8rem}
.activity li{align-items:baseline;flex-wrap:wrap}
.error{color:#b91c1c}
.danger{color:#b91c1c}
@media(max-width:700px){li{align-items:stretch;flex-direction:column}input[name=destination]{min-width:0;width:100%}}
`;

export const landingStyles = `
:root{--paper:#f3efe5;--surface:#fffdf7;--ink:#172117;--muted:#586458;--line:#c9cec3;--accent:#c8ff5a;--accent-ink:#213800;--space-1:4px;--space-2:8px;--space-3:12px;--space-4:16px;--space-5:24px;--space-6:32px;--space-7:48px;--space-8:64px;--space-9:96px;--radius:18px;--shadow:0 18px 50px rgba(23,33,23,.1)}
*{box-sizing:border-box}
html{background:var(--paper)}
body{min-width:320px;min-height:100svh;margin:0;color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:radial-gradient(circle at 85% 12%,rgba(200,255,90,.42),transparent 27rem),linear-gradient(rgba(23,33,23,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(23,33,23,.045) 1px,transparent 1px),var(--paper);background-size:auto,32px 32px,32px 32px,auto}
a{color:inherit}
a:focus-visible{outline:3px solid var(--ink);outline-offset:4px}
.shell{width:min(1180px,calc(100% - 48px));min-height:100svh;margin:auto;display:grid;grid-template-rows:auto 1fr auto}
.site-header{min-height:88px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line)}
.brand{display:inline-flex;align-items:center;gap:var(--space-3);font:700 18px/1 ui-monospace,SFMono-Regular,Menlo,monospace;text-decoration:none;letter-spacing:-.03em}
.brand-mark{width:32px;height:32px;display:grid;place-items:center;border-radius:50%;background:var(--ink);color:var(--accent);font-size:18px}
.admin-link{min-height:44px;display:inline-flex;align-items:center;gap:var(--space-2);font-size:14px;font-weight:700;text-underline-offset:4px}
main{padding:var(--space-9) 0 var(--space-8)}
.hero{display:grid;grid-template-columns:minmax(0,1fr) 300px;align-items:end;gap:var(--space-8)}
.eyebrow{display:flex;align-items:center;gap:var(--space-2);margin:0 0 var(--space-5);font:700 12px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.12em;text-transform:uppercase}
.eyebrow::before{content:"";width:9px;height:9px;border-radius:50%;background:#4f7f00;box-shadow:0 0 0 5px rgba(79,127,0,.13)}
h1{max-width:850px;margin:0;font-size:clamp(56px,9vw,112px);line-height:.88;letter-spacing:-.075em;font-weight:820}
h1 em{color:#4a7700;font-family:Georgia,"Times New Roman",serif;font-weight:400}
.hero-copy{max-width:34rem}
.lede{max-width:29rem;margin:var(--space-6) 0;color:var(--muted);font-size:clamp(18px,2vw,22px);line-height:1.55}
.cta{min-height:52px;display:inline-flex;align-items:center;gap:var(--space-3);padding:0 var(--space-5);border:2px solid var(--ink);border-radius:999px;background:var(--accent);color:var(--accent-ink);font-weight:800;text-decoration:none;box-shadow:5px 5px 0 var(--ink)}
.cta:hover{box-shadow:2px 2px 0 var(--ink);transform:translate(3px,3px)}
.signal{aspect-ratio:1;display:grid;place-items:center;position:relative;border-radius:50%;background:var(--ink);color:var(--accent);box-shadow:var(--shadow)}
.signal-arrow{font-size:clamp(88px,12vw,150px);font-weight:300;line-height:1;transform:translateY(-5px)}
.signal-code{position:absolute;right:10%;bottom:12%;font:700 14px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.15em}
.examples{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--space-4);margin-top:var(--space-9)}
.example{min-width:0;padding:var(--space-6);border:1px solid rgba(23,33,23,.18);border-radius:var(--radius);background:rgba(255,253,247,.88);box-shadow:0 8px 24px rgba(23,33,23,.06)}
.example-meta{display:flex;justify-content:space-between;gap:var(--space-4);margin-bottom:var(--space-7);color:var(--muted);font:700 12px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;text-transform:uppercase;letter-spacing:.1em}
.example code{display:block;overflow-wrap:anywhere;font:700 clamp(22px,3vw,34px)/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:-.05em}
.example p{margin:var(--space-4) 0 0;color:var(--muted);font-size:15px;line-height:1.6}
.site-footer{min-height:88px;display:flex;align-items:center;justify-content:space-between;gap:var(--space-4);border-top:1px solid var(--line);color:var(--muted);font:600 12px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace}
@media(max-width:760px){.shell{width:min(100% - 32px,1180px)}.site-header{min-height:72px}main{padding:var(--space-8) 0}.hero{grid-template-columns:1fr;gap:var(--space-7)}.signal{width:min(64vw,240px);justify-self:end}.examples{grid-template-columns:1fr;margin-top:var(--space-8)}.example-meta{margin-bottom:var(--space-6)}.site-footer{padding:var(--space-5) 0;align-items:flex-start;flex-direction:column}}
@media(max-width:420px){.admin-link span{display:none}h1{font-size:54px}.example{padding:var(--space-5)}}
`;
