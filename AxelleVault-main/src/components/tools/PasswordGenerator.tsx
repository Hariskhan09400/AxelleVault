import { useState, useCallback } from 'react';
import { Key, Copy, RefreshCw, Check, Shuffle, Lightbulb, Hash } from 'lucide-react';
import { analyzePasswordStrength } from '../../utils/securityTools';
import { useAuth } from '../../hooks/useAuth';
import { saveLog } from '../../lib/securityLogger';

// ─── Word list for memorable passwords ───────────────────────────────────────
const WORD_LIST = [
  'abandon','ability','absent','absorb','abstract','absurd','abuse','access',
  'account','accuse','achieve','acid','acoustic','acquire','across','action',
  'actor','actual','adapt','addict','address','adjust','admit','adult','advance',
  'advice','afford','afraid','again','agent','agree','ahead','alarm','album',
  'alcohol','alert','alien','alley','allow','almost','alone','alpha','already',
  'alter','always','amateur','amused','anchor','ancient','anger','angle','angry',
  'animal','answer','antenna','antique','anxiety','appear','apple','approve',
  'arctic','argue','arrest','arrive','arrow','artifact','aspect','assault',
  'asset','attend','attract','audit','august','average','avocado','avoid',
  'awake','aware','balance','bamboo','banner','barely','battle','beauty','become',
  'before','behave','believe','below','benefit','better','between','beyond',
  'bicycle','bitter','black','blade','blame','blanket','blast','bleak','bless',
  'blind','blood','blossom','blouse','blue','blur','board','boost','border',
  'boring','borrow','bounce','brave','breeze','brick','bridge','brief','bright',
  'bring','brisk','broken','bronze','brown','budget','build','burden','burst',
  'butter','buyer','cable','camel','camera','cancel','canvas','capital','cargo',
  'carpet','casual','category','cattle','caution','ceiling','celery','cement',
  'chaos','chapter','charge','chase','cheap','cherry','chief','child','chimney',
  'choice','choose','chronic','circle','citizen','civil','claim','clamp','clarify',
  'claw','clay','clean','clerk','clever','click','client','climb','clinic',
  'clipper','clock','clone','close','cloud','clown','cluster','coarse','cobalt',
  'coffee','column','combine','comfort','comic','common','conduct','confirm',
  'congress','connect','consider','control','convince','copper','coral','corner',
  'correct','counter','couple','course','cousin','cover','coward','crane',
  'credit','crisp','critic','cross','crowd','crucial','cruel','cruise','crunch',
  'crush','curve','cycle','damage','dance','danger','daring','daring','decide',
  'decline','decor','degree','delay','deliver','denial','depend','depth','derive',
  'desert','design','detail','detect','develop','device','devote','diagram',
  'differ','digital','divert','document','domain','donate','double','dragon',
  'drama','drastic','drill','drive','drown','during','dynamic','eager','early',
  'easily','either','elect','elegant','emerge','emotion','employ','enact','endure',
  'engage','engine','enhance','enjoy','enter','entire','entry','equal','error',
  'estate','evolve','exact','excess','excited','exclude','excuse','exist','expect',
  'fabric','false','famous','fancy','fantasy','father','fatigue','federal','fiber',
  'fiction','figure','final','finger','finite','fiscal','flame','flap','flavor',
  'flight','float','flock','floor','flower','fluid','flush','focus','foil',
  'follow','forbid','forest','found','fragile','frame','frequent','friend','frost',
  'frown','frozen','funny','future','galaxy','garbage','gather','genuine','gesture',
  'give','glare','gloom','glove','glow','govern','grab','grace','grain','grant',
  'grape','gravity','great','green','grief','grin','group','guard','guess',
  'guide','guitar','habit','hammer','happy','harbor','harsh','harvest','haunt',
  'health','heavy','here','hero','hidden','high','holder','hollow','honest',
  'honey','hope','horror','horse','humble','humor','hybrid','image','immune',
  'impact','improve','income','index','infant','inflict','inform','inside',
  'interest','invest','isolate','jacket','jaguar','jewel','journey','judge',
  'jungle','kangaroo','label','language','laptop','later','launch','layer','lazy',
  'leader','learn','legal','legend','lemon','length','lesson','level','limit',
  'liquid','little','lively','locate','logic','lonely','lounge','lucky','lunch',
  'luxury','magic','manage','maple','marble','market','master','match','mature',
  'meadow','memory','middle','million','mirror','mistake','mobile','modify',
  'moment','money','month','moral','motion','motor','mountain','music','naive',
  'nature','neutral','night','noble','normal','notice','novel','noodle','object',
  'oblige','observe','obtain','ocean','offer','often','operate','oppose','option',
  'orange','order','organ','orient','orphan','output','owner','palace','panel',
  'panic','paper','parade','parent','partial','patch','patient','pause','peace',
  'penalty','people','perfect','permit','phase','phone','phrase','phrase','piano',
  'picnic','pilot','pizza','place','planet','plastic','pledge','plunge','poetry',
  'polar','police','pool','popular','portion','powder','power','practice','praise',
  'prefer','present','pretty','price','primary','prison','process','profit',
  'program','project','protect','proud','provide','public','puzzle','quality',
  'quantum','quarter','question','quick','quiet','quote','rabbit','radar','random',
  'rapid','rather','real','reason','rebuild','receipt','recent','refuse','region',
  'reject','remain','render','report','require','rescue','response','result',
  'retire','return','revenue','review','rhythm','right','rigid','ritual','river',
  'rocket','roof','rotate','rough','route','royal','rubber','rural','sample',
  'satisfy','save','scale','scene','school','science','scout','search','season',
  'second','secret','select','sense','series','service','settle','severe','share',
  'shift','short','simple','sister','sketch','slight','small','smile','social',
  'solar','solid','solution','someone','source','spare','speak','spread','spring',
  'square','stable','stamp','stand','start','state','station','stay','steak',
  'step','still','stock','stone','store','story','strategy','strike','strong',
  'student','sudden','sugar','super','supply','supreme','surface','system',
  'tackle','talent','target','teach','team','tenant','theory','there','threat',
  'ticket','title','today','toddler','together','tower','trade','tradition',
  'traffic','transfer','travel','trouble','trust','tunnel','typical','umbrella',
  'unable','uniform','unique','until','update','urban','useful','usual','vanish',
  'vapor','vault','verify','victim','video','view','village','virtual','visual',
  'vital','vivid','vocal','volume','voyage','water','wealth','weapon','welcome',
  'width','window','winter','wisdom','withdraw','woman','wonder','world','worth',
];

type Mode = 'random' | 'memorable' | 'pin';

const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const NUMS  = '0123456789';
const SYMS  = '!@#$%^&*-_=+';

function randChar(pool: string) {
  return pool[Math.floor(Math.random() * pool.length)];
}

function generateRandomPw(
  length: number,
  useNumbers: boolean,
  useSymbols: boolean
): string {
  let pool = UPPER + LOWER;
  if (useNumbers) pool += NUMS;
  if (useSymbols) pool += SYMS;
  let pw = '';
  for (let i = 0; i < length; i++) pw += randChar(pool);
  return pw;
}

function generatePin(length: number): string {
  let pin = '';
  for (let i = 0; i < length; i++) pin += Math.floor(Math.random() * 10);
  return pin;
}

function generateMemorable(
  wordCount: number,
  capitalize: boolean,
  fullWords: boolean,
  separator: string
): string {
  const picked: string[] = [];
  const copy = [...WORD_LIST];
  for (let i = 0; i < wordCount; i++) {
    const idx = Math.floor(Math.random() * copy.length);
    let word = copy.splice(idx, 1)[0];
    if (!fullWords) word = word.slice(0, Math.ceil(word.length * 0.6));
    if (capitalize) word = word.charAt(0).toUpperCase() + word.slice(1);
    picked.push(word);
  }
  return picked.join(separator);
}

// ─── Colored random password renderer ────────────────────────────────────────
function ColoredPassword({ pw }: { pw: string }) {
  return (
    <span className="font-mono text-lg break-all leading-relaxed">
      {pw.split('').map((c, i) => {
        let cls = 'text-gray-300';
        if (UPPER.includes(c)) cls = 'text-cyan-400 font-semibold';
        else if (NUMS.includes(c)) cls = 'text-violet-400 font-semibold';
        else if (SYMS.includes(c)) cls = 'text-orange-400 font-semibold';
        return <span key={i} className={cls}>{c}</span>;
      })}
    </span>
  );
}

// ─── Colored memorable password renderer ─────────────────────────────────────
const WORD_COLORS = [
  'text-cyan-400','text-violet-400','text-orange-400','text-emerald-400',
  'text-pink-400','text-yellow-400',
];

function ColoredMemorable({ pw, separator }: { pw: string; separator: string }) {
  const sep = separator || '';
  const words = sep ? pw.split(sep) : [pw];
  return (
    <span className="font-mono text-lg break-all leading-relaxed">
      {words.map((w, i) => (
        <span key={i}>
          <span className={WORD_COLORS[i % WORD_COLORS.length]}>{w}</span>
          {i < words.length - 1 && sep && (
            <span className="text-gray-500">{sep}</span>
          )}
        </span>
      ))}
    </span>
  );
}

// ─── Toggle switch component ──────────────────────────────────────────────────
function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <div
        onClick={() => onChange(!on)}
        className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${
          on ? 'bg-blue-500' : 'bg-gray-600'
        }`}
      >
        <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
          on ? 'translate-x-5' : 'translate-x-0'
        }`} />
      </div>
      <span className="text-sm text-gray-400">{label}</span>
    </label>
  );
}

// ─── Strength bar ─────────────────────────────────────────────────────────────
function StrengthBar({ score, label }: { score: number; label: string }) {
  const color =
    score >= 80 ? 'bg-emerald-500' :
    score >= 60 ? 'bg-cyan-500' :
    score >= 40 ? 'bg-yellow-500' : 'bg-red-500';
  const textColor =
    score >= 80 ? 'text-emerald-400' :
    score >= 60 ? 'text-cyan-400' :
    score >= 40 ? 'text-yellow-400' : 'text-red-400';

  return (
    <div>
      <div className="flex justify-between text-xs mb-1.5">
        <span className="text-gray-500 uppercase tracking-wide">Strength</span>
        <span className={`font-semibold ${textColor}`}>{label} · {score}/100</span>
      </div>
      <div className="w-full bg-gray-700 rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export const PasswordGenerator = () => {
  const { user } = useAuth();

  // mode
  const [mode, setMode] = useState<Mode>('random');

  // random options
  const [randomLength, setRandomLength] = useState(16);
  const [useNumbers, setUseNumbers]     = useState(true);
  const [useSymbols, setUseSymbols]     = useState(false);

  // memorable options
  const [wordCount, setWordCount]       = useState(4);
  const [capitalize, setCapitalize]     = useState(false);
  const [fullWords, setFullWords]       = useState(true);
  const [separator, setSeparator]       = useState('-');

  // pin options
  const [pinLength, setPinLength]       = useState(6);

  // output
  const [password, setPassword]         = useState('');
  const [analysis, setAnalysis]         = useState<ReturnType<typeof analyzePasswordStrength> | null>(null);
  const [copied, setCopied]             = useState(false);

  const generate = useCallback(async (
    m = mode,
    rLen = randomLength, nums = useNumbers, syms = useSymbols,
    wCnt = wordCount, cap = capitalize, full = fullWords, sep = separator,
    pLen = pinLength,
  ) => {
    let pw = '';
    if (m === 'random')    pw = generateRandomPw(rLen, nums, syms);
    if (m === 'pin')       pw = generatePin(pLen);
    if (m === 'memorable') pw = generateMemorable(wCnt, cap, full, sep);
    setPassword(pw);
    setAnalysis(m !== 'pin' ? analyzePasswordStrength(pw) : null);
    if (user) {
      await saveLog(user.id, 'password_generated', { mode: m, length: pw.length }, 'low');
    }
  }, [mode, randomLength, useNumbers, useSymbols, wordCount, capitalize, fullWords, separator, pinLength, user]);

  const copyToClipboard = () => {
    if (!password) return;
    navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setPassword('');
    setAnalysis(null);
  };

  // ─── Tab config ──────────────────────────────────────────────────────────────
  const tabs: { id: Mode; label: string; icon: React.ReactNode }[] = [
    { id: 'random',     label: 'Random',     icon: <Shuffle className="w-3.5 h-3.5" /> },
    { id: 'memorable',  label: 'Memorable',  icon: <Lightbulb className="w-3.5 h-3.5" /> },
    { id: 'pin',        label: 'PIN',        icon: <Hash className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="bg-gray-900/60 backdrop-blur-xl border border-cyan-500/20 rounded-2xl p-6 shadow-2xl shadow-black/40">

      {/* Header */}
      <div className="flex items-center mb-6">
        <Key className="w-5 h-5 text-cyan-400 mr-2.5" />
        <h3 className="text-lg font-semibold text-white">Password Generator</h3>
      </div>

      {/* Mode tabs */}
      <div className="mb-5">
        <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">Choose password type</p>
        <div className="flex bg-gray-800/60 border border-gray-700/50 rounded-xl p-1 gap-1">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => switchMode(t.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-150 ${
                mode === t.id
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── RANDOM panel ── */}
      {mode === 'random' && (
        <div className="space-y-4 mb-5">
          <p className="text-xs text-gray-500 uppercase tracking-widest">Customize your new password</p>
          <div className="border-b border-gray-700/40 pb-4">
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-400 w-24 shrink-0">Characters</span>
              <input
                type="range" min={8} max={64} step={1} value={randomLength}
                onChange={e => setRandomLength(Number(e.target.value))}
                className="flex-1 h-1.5 rounded-full accent-blue-500 cursor-pointer"
              />
              <span className="text-sm font-semibold text-white w-8 text-right">{randomLength}</span>
            </div>
          </div>
          <div className="flex gap-8 border-b border-gray-700/40 pb-4">
            <Toggle on={useNumbers} onChange={setUseNumbers} label="Numbers" />
            <Toggle on={useSymbols} onChange={setUseSymbols} label="Symbols" />
          </div>
        </div>
      )}

      {/* ── MEMORABLE panel ── */}
      {mode === 'memorable' && (
        <div className="space-y-4 mb-5">
          <p className="text-xs text-gray-500 uppercase tracking-widest">Customize your new password</p>
          <div className="border-b border-gray-700/40 pb-4">
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-400 w-24 shrink-0">Words</span>
              <input
                type="range" min={2} max={8} step={1} value={wordCount}
                onChange={e => setWordCount(Number(e.target.value))}
                className="flex-1 h-1.5 rounded-full accent-blue-500 cursor-pointer"
              />
              <span className="text-sm font-semibold text-white w-8 text-right">{wordCount}</span>
            </div>
          </div>
          <div className="flex gap-6 border-b border-gray-700/40 pb-4 flex-wrap">
            <Toggle on={capitalize} onChange={setCapitalize} label="Capitalize the first letter" />
            <Toggle on={fullWords}  onChange={setFullWords}  label="Use full words" />
          </div>
          {/* Separator picker */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 mr-1">Separator:</span>
            {(['-', '.', '_', ''] as const).map(s => (
              <button
                key={s === '' ? 'none' : s}
                onClick={() => setSeparator(s)}
                className={`px-3 py-1 rounded-lg text-xs font-mono font-semibold border transition-all ${
                  separator === s
                    ? 'bg-blue-500/20 border-blue-500/60 text-blue-300'
                    : 'border-gray-600 text-gray-400 hover:border-gray-400 hover:text-gray-200'
                }`}
              >
                {s === '' ? 'None' : s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── PIN panel ── */}
      {mode === 'pin' && (
        <div className="space-y-4 mb-5">
          <p className="text-xs text-gray-500 uppercase tracking-widest">Customize your new password</p>
          <div className="border-b border-gray-700/40 pb-4">
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-400 w-24 shrink-0">Characters</span>
              <input
                type="range" min={4} max={12} step={1} value={pinLength}
                onChange={e => setPinLength(Number(e.target.value))}
                className="flex-1 h-1.5 rounded-full accent-blue-500 cursor-pointer"
              />
              <span className="text-sm font-semibold text-white w-8 text-right">{pinLength}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Generated password display ── */}
      <div className="mb-4">
        <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Generated password</p>
        <div className={`bg-gray-800/50 border border-gray-700/50 rounded-xl px-5 py-4 min-h-[72px] flex items-center ${
          mode === 'pin' ? 'justify-center' : ''
        }`}>
          {!password ? (
            <span className="text-gray-600 text-sm font-mono">Click generate…</span>
          ) : mode === 'pin' ? (
            <span className="font-mono text-3xl font-bold text-blue-400 tracking-[0.35em]">{password}</span>
          ) : mode === 'memorable' ? (
            <ColoredMemorable pw={password} separator={separator} />
          ) : (
            <ColoredPassword pw={password} />
          )}
        </div>
      </div>

      {/* Strength bar */}
      {analysis && password && (
        <div className="mb-4 bg-gray-800/30 border border-gray-700/40 rounded-xl px-4 py-3 space-y-2">
          <StrengthBar score={analysis.score} label={analysis.strength} />
          <div className="flex gap-4 pt-1">
            <span className="text-xs text-gray-600">Entropy: <span className="text-gray-400">{analysis.entropy.toFixed(1)} bits</span></span>
            <span className="text-xs text-gray-600">Crack time: <span className="text-gray-400">{analysis.crackTime}</span></span>
          </div>
        </div>
      )}

      {/* Buttons */}
      <div className="flex gap-3">
        <button
          onClick={copyToClipboard}
          disabled={!password}
          className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all duration-150 flex items-center justify-center gap-2 text-sm"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copied ? 'Copied!' : 'Copy password'}
        </button>
        <button
          onClick={() => generate()}
          className="flex-1 bg-transparent border border-blue-500/50 hover:border-blue-400 hover:bg-blue-500/10 text-blue-400 hover:text-blue-300 font-semibold py-3 rounded-xl transition-all duration-150 flex items-center justify-center gap-2 text-sm"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh password
        </button>
      </div>
    </div>
  );
};