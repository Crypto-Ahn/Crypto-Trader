import React, { useState, useEffect, useRef } from 'react';
import { Activity, TrendingUp, TrendingDown, AlertCircle, Info, Lock, ArrowUpRight, ArrowDownRight, Minus, ClipboardList, Key } from 'lucide-react';
import './App.css';
import { getBinanceData, getUpbitData, getBinanceSymbols, getUpbitSymbols } from './api';
import { analyzeData } from './ta';
import { ChartComponent } from './ChartComponent';
import { useAuth } from './AuthContext';
import { ScannerWidget } from './ScannerWidget';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return <div style={{color: 'red', padding: '20px'}}>
        <h1>Something went wrong.</h1>
        <pre>{this.state.error && this.state.error.toString()}</pre>
      </div>;
    }
    return this.props.children;
  }
}

// ------------------------------------------
// Auth & Pricing Modals
// ------------------------------------------

const AuthModal = () => {
  const { isAuthModalOpen, setAuthModalOpen, login, register } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  if (!isAuthModalOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isLogin) {
      const success = login(email, password);
      if (!success) setError('이메일 또는 비밀번호가 틀렸습니다.');
    } else {
      const success = register(email, password);
      if (!success) setError('이미 존재하는 이메일입니다.');
    }
  };

  const handleForgotPassword = () => {
    const users = JSON.parse(localStorage.getItem('crypto_users_db') || '{}');
    if (Object.keys(users).length === 0) {
      alert("등록된 계정이 없습니다.");
      return;
    }
    
    if (email && users[email]) {
      alert(`해당 계정의 비밀번호는 [ ${users[email].password} ] 입니다.`);
    } else {
      // Show all accounts for easy testing in mock DB
      const accountList = Object.values(users).map(u => `이메일: ${u.email}\n비밀번호: ${u.password}`).join('\n\n');
      alert(`[로컬 테스트용 계정 복구]\n가입하신 이메일을 입력창에 적고 아이콘을 누르면 해당 비밀번호를 찾아줍니다.\n또는 현재 등록된 모든 계정은 아래와 같습니다:\n\n${accountList}`);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>{isLogin ? '로그인' : '회원가입'}</h2>
        {error && <div style={{ color: '#ef4444', marginBottom: '12px', fontSize: '0.9rem' }}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>이메일</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="form-group" style={{ position: 'relative' }}>
            <label>비밀번호</label>
            <input type="password" required value={password} onChange={e => setPassword(e.target.value)} style={{ paddingRight: isLogin ? '36px' : '12px' }} />
            {isLogin && (
              <Key 
                size={18} 
                style={{ position: 'absolute', right: '12px', top: '34px', cursor: 'pointer', color: 'var(--text-secondary)' }} 
                onClick={handleForgotPassword}
                title="비밀번호 찾기"
              />
            )}
          </div>
          <button type="submit" className="primary full-btn">
            {isLogin ? '로그인' : '가입하고 1일 무료 체험 시작하기'}
          </button>
        </form>
        <span className="text-link" onClick={() => { setIsLogin(!isLogin); setError(''); }}>
          {isLogin ? '계정이 없으신가요? 회원가입' : '이미 계정이 있으신가요? 로그인'}
        </span>
        <span className="text-link" style={{ color: 'var(--text-secondary)' }} onClick={() => setAuthModalOpen(false)}>
          닫기
        </span>
      </div>
    </div>
  );
};

const PricingModal = () => {
  const { isPricingModalOpen, setPricingModalOpen, subscribe } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState('monthly');

  if (!isPricingModalOpen) return null;

  const handlePayment = () => {
    // Simulate Toss Payments Checkout
    alert(`토스페이먼츠 결제창 호출 시뮬레이션...\n\n플랜: ${selectedPlan === 'monthly' ? '월간' : '연간'}\n금액: ${selectedPlan === 'monthly' ? '9,900원' : '66,000원'} (VAT 포함)\n\n결제가 성공적으로 완료되었습니다!`);
    subscribe(selectedPlan);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ width: '500px' }}>
        <h2>구독 플랜 선택</h2>
        <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '24px' }}>
          CryptoTrader Pro AI의 모든 분석 기능과 실시간 타겟가를 무제한으로 이용하세요.
        </p>

        <div 
          className={`pricing-card ${selectedPlan === 'monthly' ? 'selected' : ''}`}
          onClick={() => setSelectedPlan('monthly')}
        >
          <div className="pricing-title">월간 구독 (Monthly)</div>
          <div className="pricing-price">₩9,900 <span style={{fontSize: '0.9rem', fontWeight: 400, color: 'var(--text-secondary)'}}>/ 월 (VAT 포함)</span></div>
        </div>

        <div 
          className={`pricing-card ${selectedPlan === 'yearly' ? 'selected' : ''}`}
          onClick={() => setSelectedPlan('yearly')}
        >
          <div className="pricing-title">연간 구독 (Yearly) <span style={{ color: '#10b981', fontSize: '0.8rem', marginLeft: '8px' }}>44% 할인!</span></div>
          <div className="pricing-price">₩66,000 <span style={{fontSize: '0.9rem', fontWeight: 400, color: 'var(--text-secondary)'}}>/ 년 (VAT 포함)</span></div>
        </div>

        <button className="primary full-btn" onClick={handlePayment} style={{ marginTop: '24px' }}>
          토스페이먼츠로 결제하기
        </button>
        <span className="text-link" style={{ color: 'var(--text-secondary)' }} onClick={() => setPricingModalOpen(false)}>
          나중에 하기
        </span>
      </div>
    </div>
  );
};

// ------------------------------------------
// Main Application
// ------------------------------------------

function App() {
  const { user, logout, getTrialStatus, setAuthModalOpen, setPricingModalOpen } = useAuth();
  const trialStatus = getTrialStatus();

  const [exchange, setExchange] = useState('Binance');
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [availableSymbols, setAvailableSymbols] = useState([]);
  const [interval, setInterval] = useState('1h');
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [frozenSignal, setFrozenSignal] = useState(null);
  
  const [signal, setSignal] = useState({
    type: 'NEUTRAL',
    entry: 0,
    takeProfit: 0,
    stopLoss: 0,
    currentPrice: 0,
    indicators: [],
    setupReasons: [],
    tradePlan: null,
    support: [0, 0],
    resistance: [0, 0]
  });

  const pendingSymbolRef = useRef(null);

  // Handle exchange change
  useEffect(() => {
    let isMounted = true;
    const fetchSymbols = async () => {
      let symbols = [];
      if (exchange === 'Binance') {
        symbols = await getBinanceSymbols();
        if (isMounted) {
          setAvailableSymbols(symbols);
          if (pendingSymbolRef.current) {
            setSymbol(pendingSymbolRef.current);
            pendingSymbolRef.current = null;
          } else {
            setSymbol('BTCUSDT');
          }
        }
      } else {
        symbols = await getUpbitSymbols();
        if (isMounted) {
          setAvailableSymbols(symbols);
          if (pendingSymbolRef.current) {
            setSymbol(pendingSymbolRef.current);
            pendingSymbolRef.current = null;
          } else {
            setSymbol('BTCKRW');
          }
        }
      }
    };
    fetchSymbols();
    return () => { isMounted = false; };
  }, [exchange]);

  // Fetch data and analyze
  useEffect(() => {
    let isMounted = true;
    
    const fetchData = async () => {
      try {
        setLoading(true);
        setErrorMsg('');
        let data = [];
        if (exchange === 'Binance') {
          data = await getBinanceData(symbol, interval, 3000);
        } else {
          let upbitInterval = '60';
          if (interval === '1m') upbitInterval = '1';
          if (interval === '5m') upbitInterval = '5';
          if (interval === '15m') upbitInterval = '15';
          if (interval === '30m') upbitInterval = '30';
          if (interval === '1h') upbitInterval = '60';
          if (interval === '4h') upbitInterval = '240';
          if (interval === '1d') upbitInterval = '1d';
          if (interval === '1w') upbitInterval = '1w';
          
          if (upbitInterval === '1d') {
            data = await getUpbitData(symbol, 'days', 2000);
          } else if (upbitInterval === '1w') {
            data = await getUpbitData(symbol, 'weeks', 2000);
          } else {
            data = await getUpbitData(symbol, upbitInterval, 2000);
          }
        }

        if (isMounted && data && data.length > 0) {
          setChartData(data);
          try {
            const analysis = analyzeData(data, exchange);
            if (analysis) {
              setSignal(analysis);
            }
          } catch (taError) {
            console.error("TA Analysis Error:", taError);
            setErrorMsg('Analysis failed: ' + taError.message);
          }
        }
      } catch (err) {
        console.error("Fetch Data Error:", err);
        setErrorMsg('Data fetch failed: ' + err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchData();
    const timer = window.setInterval(fetchData, 60000);

    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [exchange, symbol, interval]);

  const canViewSignals = user && trialStatus.isActive;

  const timeframes = [
    { label: '1m', value: '1m' },
    { label: '5m', value: '5m' },
    { label: '15m', value: '15m' },
    { label: '30m', value: '30m' },
    { label: '1H', value: '1h' },
    { label: '4H', value: '4h' },
    { label: '1D', value: '1d' },
    { label: '1W', value: '1w' }
  ];

  return (
    <ErrorBoundary>
      <div className="app-container">
        <AuthModal />
        <PricingModal />

        <header className="app-header glass-panel">
          <h1><Activity color="#3b82f6" size={28} /> CryptoTrader Pro AI</h1>
          <div className="controls" style={{ flex: 1, justifyContent: 'center' }}>
            <select value={exchange} onChange={(e) => { setExchange(e.target.value); setFrozenSignal(null); }}>
              <option value="Binance">Binance (Global)</option>
              <option value="Upbit">Upbit (Korea)</option>
            </select>
            
            <input 
              list="symbol-list" 
              value={symbol} 
              onChange={(e) => { setSymbol(e.target.value.toUpperCase()); setFrozenSignal(null); }}
              placeholder="코인 심볼 검색 (예: BTCUSDT)"
              style={{ width: '200px' }}
            />
            <datalist id="symbol-list">
              {availableSymbols.map(s => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
          
          <div className="auth-controls">
            {!user ? (
              <button className="primary" onClick={() => setAuthModalOpen(true)}>로그인 / 회원가입</button>
            ) : (
              <>
                <div className="user-info">
                  <span className="user-email">{user.email}</span>
                  {user.isSubscribed ? (
                    <span className="trial-badge" style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa' }}>PRO 회원</span>
                  ) : trialStatus.isActive ? (
                    <span className="trial-badge">무료 체험중 ({Math.ceil(trialStatus.hoursLeft)}시간 남음)</span>
                  ) : (
                    <span className="expired-badge">무료 체험 종료</span>
                  )}
                </div>
                {!user.isSubscribed && (
                  <button className="primary" onClick={() => setPricingModalOpen(true)}>구독하기</button>
                )}
                <button onClick={logout}>로그아웃</button>
              </>
            )}
          </div>
        </header>

        <main className="main-content">
          <section className="chart-section glass-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2>{symbol} - {exchange}</h2>
              <div style={{ display: 'flex', gap: '4px' }}>
                <select 
                  value={interval} 
                  onChange={(e) => {
                    setInterval(e.target.value);
                    setFrozenSignal(null);
                  }}
                  style={{ background: 'var(--panel-bg)', padding: '6px 12px' }}
                >
                  {timeframes.map(tf => (
                    <option key={tf.value} value={tf.value}>{tf.label}</option>
                  ))}
                </select>
              </div>
            </div>
            {errorMsg && <div style={{ color: '#ef4444', marginBottom: '10px' }}>{errorMsg}</div>}
            <div className="chart-container" id="tv-chart">
              {loading && chartData.length === 0 ? (
                <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                  Loading chart data...
                </div>
              ) : (
                <ChartComponent data={chartData} smaData={signal?.smaData} signal={canViewSignals ? signal : null} />
              )}
            </div>
          </section>

          <aside className="side-panel glass-panel">
            <div className="gate-wrapper">
              {!canViewSignals && (
                <div className="gate-overlay">
                  <Lock size={48} color="rgba(255,255,255,0.5)" style={{ marginBottom: '16px' }} />
                  {!user ? (
                    <>
                      <h3>분석 결과를 보려면 로그인이 필요합니다.</h3>
                      <p>지금 가입하고 하루 동안 PRO 분석 기능을 무료로 체험해 보세요!</p>
                      <button className="primary" onClick={() => setAuthModalOpen(true)}>로그인 / 회원가입</button>
                    </>
                  ) : (
                    <>
                      <h3>무료 체험 기간이 종료되었습니다.</h3>
                      <p>실시간 AI 분석 신호를 계속 받으시려면 구독을 시작해 주세요.</p>
                      <button className="primary" onClick={() => setPricingModalOpen(true)}>구독 플랜 보기 (월 9,900원~)</button>
                    </>
                  )}
                </div>
              )}

              <div className={`signal-card ${!canViewSignals ? 'gate-content' : ''}`}>
                <div className="panel-header">
                  <h2>
                    {symbol} 분석 리포트
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginLeft: '8px', fontWeight: 'normal' }}>
                      ({frozenSignal ? frozenSignal.interval : interval} 기준)
                    </span>
                  </h2>
                  <span className={`signal-badge ${(frozenSignal || signal)?.type?.toLowerCase() || 'neutral'}`}>
                    {(() => {
                      const currentType = (frozenSignal || signal)?.type;
                      if (currentType === 'LONG') return <><ArrowUpRight size={16} /> LONG ENTRY</>;
                      if (currentType === 'SHORT') return <><ArrowDownRight size={16} /> SHORT ENTRY</>;
                      return <><Minus size={16} /> NEUTRAL ENTRY</>;
                    })()}
                  </span>
                </div>

                {(frozenSignal || signal)?.tradePlan ? (
                  <div className="trade-plan">
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: '#fff', fontSize: '1.1rem' }}>
                      <ClipboardList size={20} color="var(--accent-color)" /> Trade Plan
                      {frozenSignal && <span style={{ fontSize: '0.7rem', color: 'var(--color-up)', border: '1px solid var(--color-up)', padding: '2px 6px', borderRadius: '4px', marginLeft: 'auto' }}>Scanner Frozen</span>}
                    </h3>
                    <div className="plan-grid">
                      <div className="plan-label">Entry:</div>
                      <div className="plan-value entry">{(frozenSignal || signal).tradePlan.entryRange}</div>
                      
                      <div className="plan-label">SL:</div>
                      <div className="plan-value sl">{(frozenSignal || signal).tradePlan.sl}</div>
                      
                      <div className="plan-label">TP1:</div>
                      <div className="plan-value tp1">{(frozenSignal || signal).tradePlan.tp1}</div>
                      
                      <div className="plan-label">TP2:</div>
                      <div className="plan-value tp2">{(frozenSignal || signal).tradePlan.tp2}</div>
                      
                      <div className="plan-label">TP3:</div>
                      <div className="plan-value tp3">{(frozenSignal || signal).tradePlan.tp3}</div>
                    </div>
                  </div>
                ) : (
                  <div className="trade-plan" style={{ opacity: 0.5, textAlign: 'center', padding: '20px' }}>
                    <ClipboardList size={24} style={{ margin: '0 auto 10px', display: 'block', opacity: 0.5 }} />
                    신호가 발생하지 않아 트레이드 플랜이 없습니다.
                  </div>
                )}

                <div className="reasons-box">
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: '#60a5fa', fontSize: '0.9rem' }}>
                    <Info size={16} /> Why this setup?
                  </h3>
                  <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--text-primary)', fontSize: '0.85rem', lineHeight: '1.6' }}>
                    {(frozenSignal || signal)?.setupReasons ? (frozenSignal || signal).setupReasons.map((r, i) => (
                      <li key={i} style={{ marginBottom: '8px' }}>{r}</li>
                    )) : <li>분석 중이거나 데이터가 부족합니다.</li>}
                  </ul>
                  
                  <div className="indicators-row">
                    {(frozenSignal || signal)?.indicators?.map((ind, i) => (
                      <span key={i} className="indicator-chip">{ind}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </aside>
          
          <ScannerWidget 
            interval={interval}
            onSelectSignal={(s) => {
              if (exchange !== s.exchange) {
                pendingSymbolRef.current = s.symbol;
                setExchange(s.exchange);
              } else {
                setSymbol(s.symbol);
              }
              setInterval(s.fullAnalysis.interval || interval);
              setFrozenSignal(s.fullAnalysis); // Lock the signal to what the scanner saw
            }}
          />
        </main>
      </div>
    </ErrorBoundary>
  );
}

export default App;
