import React, { useState, useRef, useEffect } from 'react';
import readmeText from '../README.md?raw';
import ReactMarkdown from 'react-markdown';

const App = () => {
    // App State
    const [appMode, setAppMode] = useState('Kanji'); // 'Kanji', 'English'
    const [sets, setSets] = useState([]);
    const [activeSetId, setActiveSetId] = useState('');
    const [view, setView] = useState('setup'); // 'setup', 'quiz', 'result', 'manage', 'history', 'set-list'
    const [quizMode, setQuizMode] = useState('writing'); // 'reading', 'writing' (Kanji), 'en-to-ja', 'ja-to-en' (English)
    const [readingModeType, setReadingModeType] = useState('input'); // 'input', 'self'
    const [isShuffle, setIsShuffle] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [userInput, setUserInput] = useState('');
    const [feedback, setFeedback] = useState({ type: '', message: '' });
    const [stats, setStats] = useState({ correct: 0, incorrect: 0, mistakes: [] });
    const [isAnimating, setIsAnimating] = useState(false);
    const [showAnswer, setShowAnswer] = useState(false);
    const [history, setHistory] = useState([]);

    // Quiz Execution Data
    const [quizData, setQuizData] = useState([]);

    // Modal State
    const [modal, setModal] = useState({ show: false, type: '', value: '', targetId: '' });

    // Item Management State
    const [localNewItem, setLocalNewItem] = useState({ kanji: '', reading: '', sentence: '', word: '', meaning: '' });

    const fileInputRef = useRef(null);
    const historyImportRef = useRef(null);
    const inputRef = useRef(null);

    // Default initial set structure
    const createNewSet = (name, type = 'Kanji', items = []) => ({
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        name: name || '新しいセット',
        type: type,
        items: items
    });

    const defaultSets = {
        Kanji: {
            id: 'default-kanji',
            name: '基本の漢字',
            type: 'Kanji',
            items: [
                { kanji: '学校', reading: 'がっこう', sentence: '明日から（学校）が始まる。' },
                { kanji: '勉強', reading: 'べんきょう', sentence: '毎日（勉強）をする習慣をつける。' },
                { kanji: '友達', reading: 'ともだち', sentence: '（友達）と一緒に遊ぶ。' },
            ]
        },
        English: {
            id: 'default-english',
            name: 'Basic English',
            type: 'English',
            items: [
                { word: 'apple', meaning: 'りんご' },
                { word: 'book', meaning: '本' },
                { word: 'desk', meaning: '机' },
            ]
        }
    };

    // Initial Load & public/sets Integration
    useEffect(() => {
        const loadInitialData = async () => {
            // Load History (Legacy key support)
            const savedHistory = localStorage.getItem('flashcardHistory') || localStorage.getItem('kanjiHistory');
            if (savedHistory) setHistory(JSON.parse(savedHistory));

            // Load Sets from LocalStorage
            const savedSets = localStorage.getItem('kanjiSets');
            let initialSets = savedSets ? JSON.parse(savedSets) : [];

            // Add type to legacy sets if missing
            initialSets = initialSets.map(s => s.type ? s : { ...s, type: 'Kanji' });

            // Fetch manifest from public/sets/index.json
            try {
                const response = await fetch('./sets/index.json');
                if (response.ok) {
                    const manifest = await response.json();
                    const staticSets = await Promise.all(manifest.sets.map(async (s) => {
                        if (initialSets.some(ls => ls.name === s.name && ls.type === s.type)) return null;

                        try {
                            const csvRes = await fetch(`./sets/${s.filename}`);
                            if (csvRes.ok) {
                                const csvText = await csvRes.text();
                                const items = parseCsv(csvText, s.type);
                                return { id: s.id, name: s.name, items: items, type: s.type };
                            }
                        } catch (e) {
                            console.error(`Failed to load static set: ${s.filename}`, e);
                        }
                        return null;
                    }));

                    const filteredStaticSets = staticSets.filter(s => s !== null);
                    initialSets = [...initialSets, ...filteredStaticSets];
                }
            } catch (e) {
                console.log("No static manifest (sets/index.json) found or accessible.");
            }

            // Fallback if absolutely nothing
            if (initialSets.length === 0) {
                initialSets = [defaultSets.Kanji, defaultSets.English];
            } else if (!initialSets.some(s => s.type === 'English')) {
                initialSets = [...initialSets, defaultSets.English];
            }

            setSets(initialSets);

            // Set default active set based on first available
            const firstSet = initialSets.find(s => s.type === appMode) || initialSets[0];
            setActiveSetId(firstSet.id);
            if (firstSet.type !== appMode) setAppMode(firstSet.type);
        };

        loadInitialData();
    }, []);

    const parseCsv = (text, type = 'Kanji') => {
        if (!text) return [];
        const lines = text.split(/\r?\n/).filter(line => line.trim());
        if (lines.length <= 1) return []; // Only header or empty

        return lines.slice(1).map(line => {
            const parts = line.split(',').map(s => s.trim());
            if (type === 'Kanji' && parts.length >= 3) {
                const [kanji, reading, sentence] = parts;
                return { kanji, reading, sentence };
            } else if (type === 'English' && parts.length >= 2) {
                const [word, meaning] = parts;
                return { word, meaning };
            }
            return null;
        }).filter(item => item !== null);
    };

    // Save Sets to LocalStorage
    useEffect(() => {
        if (sets.length > 0) {
            localStorage.setItem('kanjiSets', JSON.stringify(sets));
        }
    }, [sets]);

    const activeSet = sets.find(s => s.id === activeSetId) || sets[0] || defaultSets.Kanji;
    const data = activeSet ? activeSet.items : [];

    // Set Management
    const openCreateModal = () => setModal({ show: true, type: 'create', value: '', targetId: '' });
    const openRenameModal = (id, currentName) => setModal({ show: true, type: 'rename', value: currentName, targetId: id });
    const closeModal = () => setModal({ show: false, type: '', value: '', targetId: '' });

    const handleModalSubmit = (e) => {
        e.preventDefault();
        const val = modal.value.trim();
        if (!val) return;

        if (modal.type === 'create') {
            const newSet = createNewSet(val, appMode);
            setSets([...sets, newSet]);
            setActiveSetId(newSet.id);
        } else if (modal.type === 'rename') {
            setSets(sets.map(s => s.id === modal.targetId ? { ...s, name: val } : s));
        }
        closeModal();
    };

    const deleteSet = (id) => {
        if (sets.length <= 1) {
            alert('最後の問題セットは削除できません。');
            return;
        }
        if (window.confirm(`「${sets.find(s => s.id === id)?.name}」を削除してもよろしいですか？`)) {
            const newSets = sets.filter(s => s.id !== id);
            setSets(newSets);
            if (activeSetId === id) setActiveSetId(newSets[0].id);
        }
    };

    // CSV Input/Output
    const handleCsvImport = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const items = parseCsv(event.target.result, appMode);
            if (items.length === 0) {
                alert(`有効なデータが見つかりませんでした。CSVの形式を確認してください（${appMode === 'Kanji' ? '漢字,読み,例文' : '単語,意味'}）。`);
                return;
            }
            setSets(sets.map(s => s.id === activeSetId ? { ...s, items: [...(s.items || []), ...items] } : s));
        };
        reader.readAsText(file);
        e.target.value = ''; // Reset for same file re-import
    };

    const handleExport = () => {
        if (!data || data.length === 0) {
            alert('エクスポートするデータがありません。');
            return;
        }
        const headers = appMode === 'Kanji' ? "漢字,読み,例文\n" : "単語,意味\n";
        const rows = data.map(item => {
            if (appMode === 'Kanji') {
                return `${item.kanji},${item.reading},${item.sentence.replace(/,/g, '，')}`;
            } else {
                return `${item.word},${item.meaning}`;
            }
        }).join('\n');
        const blob = new Blob(["\ufeff" + headers + rows], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${activeSet.name}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const exportHistory = () => {
        const dataStr = JSON.stringify(history, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `flashcard_history_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
    };

    const handleHistoryImport = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const imported = JSON.parse(event.target.result);
                if (Array.isArray(imported)) {
                    if (window.confirm(`${imported.length}件の履歴をインポートしますか？現在の履歴は上書きされます。`)) {
                        setHistory(imported);
                        localStorage.setItem('flashcardHistory', JSON.stringify(imported));
                    }
                } else {
                    alert('無効な履歴形式です。');
                }
            } catch (err) {
                alert('JSONのパースに失敗しました。');
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    // Item Management
    const addItem = (e) => {
        e.preventDefault();
        const isKanji = appMode === 'Kanji';
        if (isKanji) {
            if (!localNewItem.kanji || !localNewItem.reading || !localNewItem.sentence) {
                alert('すべての項目を入力してください。');
                return;
            }
        } else {
            if (!localNewItem.word || !localNewItem.meaning) {
                alert('すべての項目を入力してください。');
                return;
            }
        }
        setSets(sets.map(s => s.id === activeSetId ? { ...s, items: [...(s.items || []), localNewItem] } : s));
        setLocalNewItem({ kanji: '', reading: '', sentence: '', word: '', meaning: '' });
    };

    const deleteItem = (index) => {
        setSets(sets.map(s => s.id === activeSetId ? { ...s, items: s.items.filter((_, i) => i !== index) } : s));
    };

    // Quiz Control
    const shuffleArray = (array) => {
        const newArr = [...array];
        for (let i = newArr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
        }
        return newArr;
    };

    const startQuiz = () => {
        if (!data || data.length === 0) {
            alert('このセットには問題が登録されていません。');
            return;
        }
        const finalData = isShuffle ? shuffleArray(data) : [...data];
        setQuizData(finalData);
        setStats({ correct: 0, incorrect: 0, mistakes: [] });
        setCurrentIndex(0);
        setView('quiz');
        setFeedback({ type: '', message: '' });
        setUserInput('');
        setShowAnswer(false);
    };

    const checkAnswer = (e) => {
        if (e) e.preventDefault();
        if (isAnimating || feedback.type !== '') return;

        const currentItem = quizData[currentIndex];
        const isSelfMode = appMode === 'English' || quizMode === 'writing' || (quizMode === 'reading' && readingModeType === 'self');
        if (isSelfMode) { setShowAnswer(true); return; }

        const input = userInput.trim();
        if (!input) return;

        if (input === currentItem.reading) {
            setFeedback({ type: 'correct', message: '正解！' });
            setStats(prev => ({ ...prev, correct: prev.correct + 1 }));
            setTimeout(nextQuestion, 800);
        } else {
            setFeedback({ type: 'incorrect', message: `残念！ 正解は「${currentItem.reading}」です。` });
            setStats(prev => ({
                ...prev,
                incorrect: prev.incorrect + 1,
                mistakes: [...prev.mistakes, { ...currentItem, userAnswer: input }]
            }));
            setUserInput('');
            setIsAnimating(true);
            setTimeout(() => {
                setIsAnimating(false);
                inputRef.current?.focus();
            }, 500);
            setTimeout(nextQuestion, 2000);
        }
    };

    const handleSelfAssessment = (isCorrect) => {
        const currentItem = quizData[currentIndex];
        if (isCorrect) {
            setStats(prev => ({ ...prev, correct: prev.correct + 1 }));
            setFeedback({ type: 'correct', message: '〇 正解！' });
        } else {
            setStats(prev => ({
                ...prev,
                incorrect: prev.incorrect + 1,
                mistakes: [...prev.mistakes, { ...currentItem, userAnswer: '×' }]
            }));
            setFeedback({ type: 'incorrect', message: '× 残念！' });
        }
        setTimeout(nextQuestion, 800);
    };

    const nextQuestion = () => {
        if (currentIndex < quizData.length - 1) {
            setCurrentIndex(prev => prev + 1);
            setUserInput('');
            setFeedback({ type: '', message: '' });
            setShowAnswer(false);
            setTimeout(() => inputRef.current?.focus(), 50);
        } else {
            setView('result');
        }
    };

    // Save History
    useEffect(() => {
        if (view === 'result') {
            let modeStr = "";
            if (appMode === 'Kanji') {
                modeStr = quizMode === 'writing' ? '書き' : `読み (${readingModeType === 'input' ? '入力' : '判定'})`;
            } else {
                modeStr = quizMode === 'en-to-ja' ? '英 ➜ 日' : '日 ➜ 英';
            }

            const sessionResult = {
                id: Date.now(),
                date: new Date().toLocaleString(),
                setName: activeSet.name,
                mode: modeStr,
                total: quizData.length,
                correct: stats.correct,
                incorrect: stats.incorrect,
                mistakes: [...stats.mistakes]
            };
            const updatedHistory = [sessionResult, ...history];
            setHistory(updatedHistory);
            localStorage.setItem('flashcardHistory', JSON.stringify(updatedHistory));
        }
    }, [view]);

    // View Components
    const renderModal = () => modal.show && (
        <div className="fade-in modal-overlay">
            <form onSubmit={handleModalSubmit} className="glass modal-content">
                <h2>{modal.type === 'create' ? '新しいセットを作成' : '名前を変更'}</h2>
                <input autoFocus type="text" className="input-field" value={modal.value} onChange={e => setModal({ ...modal, value: e.target.value })} placeholder="セットの名前を入力" style={{ width: '100%', margin: '1.5rem 0' }} />
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={closeModal}>キャンセル</button>
                    <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>保存</button>
                </div>
            </form>
        </div>
    );

    const renderSetup = () => {
        const filteredSets = sets.filter(s => s.type === appMode);

        return (
            <div className="fade-in container-narrow">
                <header className="main-header">
                    <h1>フラッシュカード</h1>
                    <div className="mode-selector-tabs">
                        <button className={`tab-btn ${appMode === 'Kanji' ? 'active' : ''}`} onClick={() => {
                            setAppMode('Kanji');
                            setQuizMode('writing');
                            const firstKanji = sets.find(s => s.type === 'Kanji');
                            if (firstKanji) setActiveSetId(firstKanji.id);
                        }}>漢字</button>
                        <button className={`tab-btn ${appMode === 'English' ? 'active' : ''}`} onClick={() => {
                            setAppMode('English');
                            setQuizMode('en-to-ja');
                            const firstEng = sets.find(s => s.type === 'English');
                            if (firstEng) setActiveSetId(firstEng.id);
                        }}>英単語・表現</button>
                    </div>
                </header>

                <div className="glass card">
                    <div className="form-group">
                        <label>問題セットを選択:</label>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <select className="input-field" style={{ flex: 1 }} value={activeSetId} onChange={(e) => setActiveSetId(e.target.value)}>
                                {filteredSets.map(s => <option key={s.id} value={s.id}>{s.name} ({s.items?.length || 0}問)</option>)}
                            </select>
                            <button className="btn btn-outline" onClick={() => setView('set-list')}>管理</button>
                        </div>
                    </div>

                    <div className="section-divider"></div>

                    <div className="form-group">
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                            <h2 style={{ fontSize: '1.1rem' }}>学習設定</h2>
                            <button className="btn btn-outline btn-small" onClick={() => setView('history')}>履歴</button>
                        </div>

                        {appMode === 'Kanji' ? (
                            <div className="mode-toggle-group">
                                <button className={`btn ${quizMode === 'writing' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setQuizMode('writing')}>書き</button>
                                <button className={`btn ${quizMode === 'reading' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setQuizMode('reading')}>読み</button>
                            </div>
                        ) : (
                            <div className="mode-toggle-group">
                                <button className={`btn ${quizMode === 'en-to-ja' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setQuizMode('en-to-ja')}>英 ➜ 日</button>
                                <button className={`btn ${quizMode === 'ja-to-en' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setQuizMode('ja-to-en')}>日 ➜ 英</button>
                            </div>
                        )}

                        <div className="settings-panel">
                            <label className="checkbox-label">
                                <input type="checkbox" checked={isShuffle} onChange={e => setIsShuffle(e.target.checked)} /> 問題をシャッフルする
                            </label>
                            {appMode === 'Kanji' && quizMode === 'reading' && (
                                <div className="radio-group">
                                    <label><input type="radio" checked={readingModeType === 'input'} onChange={() => setReadingModeType('input')} /> 入力</label>
                                    <label><input type="radio" checked={readingModeType === 'self'} onChange={() => setReadingModeType('self')} /> 判定のみ</label>
                                </div>
                            )}
                        </div>
                    </div>

                    <button className="btn btn-primary btn-large" onClick={startQuiz}>開始 ➜</button>
                </div>

                <div className="glass card" style={{ marginTop: '1.5rem', padding: '1rem' }}>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => openRenameModal(activeSetId, activeSet.name)}>名前変更</button>
                        <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => fileInputRef.current.click()}>CSV入力</button>
                    </div>
                    <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept=".csv" onChange={handleCsvImport} />
                    <button className="btn btn-text" style={{ width: '100%', marginTop: '0.5rem' }} onClick={handleExport}>「{activeSet.name}」を保存 (CSV)</button>
                </div>

                <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
                    <button className="btn btn-text" onClick={() => setView('help')} style={{ fontSize: '1rem', textDecoration: 'underline' }}>📚 使い方はこちら</button>
                </div>
            </div>
        );
    };

    const renderQuiz = () => {
        const item = quizData[currentIndex];
        const isKanji = appMode === 'Kanji';
        const isSelfMode = appMode === 'English' || quizMode === 'writing' || (quizMode === 'reading' && readingModeType === 'self');

        // Prepare question and answer text
        let questionText = "";
        let answerText = "";
        let sentenceText = null;

        if (isKanji) {
            const parts = item.sentence.split(/（|）/);
            questionText = quizMode === 'writing' ? item.reading : item.kanji;
            answerText = quizMode === 'writing' ? item.kanji : item.reading;
            sentenceText = (
                <div className="sentence-text">
                    {parts.map((p, i) => p === item.kanji ? (
                        <span key={i} className="target-word">{questionText}</span>
                    ) : p)}
                </div>
            );
        } else {
            questionText = quizMode === 'en-to-ja' ? item.word : item.meaning;
            answerText = quizMode === 'en-to-ja' ? item.meaning : item.word;
            sentenceText = <div className="quiz-word-display">{questionText}</div>;
        }

        return (
            <div className="fade-in container-wide">
                <div className="quiz-header">
                    <div className="quiz-meta">
                        <span>{activeSet.name} ︱ {currentIndex + 1} / {quizData.length}</span>
                        <span className="correct-count">正解: {stats.correct}</span>
                    </div>
                    <div className="progress-bar-container"><div className="progress-bar-fill" style={{ width: `${((currentIndex + 1) / quizData.length) * 100}%` }}></div></div>
                </div>

                <div className="quiz-body">
                    <div className={`flashcard ${isAnimating ? 'shake' : ''}`}>
                        {sentenceText}

                        {!isSelfMode ? (
                            <form onSubmit={checkAnswer} className="input-group-quiz">
                                <input ref={inputRef} type="text" className="input-field-large" placeholder="読みを入力" value={userInput} onChange={e => setUserInput(e.target.value)} disabled={feedback.type !== ''} autoFocus />
                                <button type="submit" className="btn btn-primary" disabled={feedback.type !== ''}>判定</button>
                            </form>
                        ) : !showAnswer ? (
                            <button className="btn btn-primary btn-answer" onClick={() => setShowAnswer(true)}>答えを見る</button>
                        ) : (
                            <div className="answer-reveal fade-in">
                                <div className="revealed-text">{answerText}</div>
                                <div className="self-assessment-actions">
                                    <button className="btn btn-incorrect" onClick={() => handleSelfAssessment(false)}>× 不正解</button>
                                    <button className="btn btn-correct" onClick={() => handleSelfAssessment(true)}>〇 正解！</button>
                                </div>
                            </div>
                        )}
                        <div className={`feedback-message ${feedback.type}`}>{feedback.message}</div>
                    </div>
                </div>
                <button className="btn btn-outline" onClick={() => setView('setup')}>中断して戻る</button>
            </div>
        );
    };

    const renderResult = () => (
        <div className="fade-in container-narrow text-center">
            <h1>学習結果</h1>
            <div className="glass result-card">
                <div className="score-circle">
                    <span className="score-num">{Math.round((stats.correct / quizData.length) * 100)}</span>
                    <span className="score-unit">%</span>
                </div>
                <p className="score-detail">{quizData.length}問中 {stats.correct}問正解</p>

                {stats.mistakes.length > 0 && (
                    <div className="mistakes-review">
                        <h3>要復習:</h3>
                        <div className="mistakes-list">
                            {stats.mistakes.map((m, i) => {
                                const isKanjiResult = !!m.kanji;
                                return (
                                    <div key={i} className="mistake-item">
                                        <div className="mistake-sentence">{isKanjiResult ? m.sentence : m.word}</div>
                                        <div className="mistake-answer">
                                            正解: <span>{isKanjiResult ? (quizMode === 'writing' ? m.kanji : m.reading) : (quizMode === 'en-to-ja' ? m.meaning : m.word)}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
            <button className="btn btn-primary btn-large" style={{ width: '100%' }} onClick={() => setView('setup')}>トップへ戻る</button>
        </div>
    );

    const renderSetList = () => {
        const filteredSets = sets.filter(s => s.type === appMode);
        return (
            <div className="fade-in container-narrow">
                <header className="view-header">
                    <h2>問題セットの管理 ({appMode === 'Kanji' ? '漢字' : '英語'})</h2>
                    <button className="btn btn-outline" onClick={() => setView('setup')}>戻る</button>
                </header>
                <div className="glass list-container">
                    {filteredSets.map(s => (
                        <div key={s.id} className="list-item">
                            <div className="item-info">
                                <span className="item-name">{s.name}</span>
                                <span className="item-count">{s.items?.length || 0}問</span>
                            </div>
                            <div className="item-actions">
                                <button className="btn btn-icon" onClick={() => openRenameModal(s.id, s.name)}>✎</button>
                                <button className="btn btn-outline btn-small" onClick={() => { setActiveSetId(s.id); setView('manage'); }}>編集</button>
                                <button className="btn btn-danger btn-small" onClick={() => deleteSet(s.id)}>削除</button>
                            </div>
                        </div>
                    ))}
                    <button className="btn btn-primary" style={{ width: '100%', marginTop: '1.5rem' }} onClick={openCreateModal}>＋ 新しいセットを作成</button>
                </div>
            </div>
        );
    };

    const renderManage = () => (
        <div className="fade-in container-wide">
            <header className="view-header">
                <div>
                    <h2>セット編集: {activeSet.name}</h2>
                    <p style={{ color: 'var(--text-muted)' }}>{data.length}問登録済み ({appMode === 'Kanji' ? '漢字モード' : '英語モード'})</p>
                </div>
                <button className="btn btn-outline" onClick={() => setView('set-list')}>戻る</button>
            </header>

            <form onSubmit={addItem} className="glass add-item-form">
                {appMode === 'Kanji' ? (
                    <div className="input-group-horizontal">
                        <input type="text" className="input-field" value={localNewItem.kanji} onChange={e => setLocalNewItem({ ...localNewItem, kanji: e.target.value })} placeholder="漢字" />
                        <input type="text" className="input-field" value={localNewItem.reading} onChange={e => setLocalNewItem({ ...localNewItem, reading: e.target.value })} placeholder="読み" />
                        <input type="text" className="input-field" value={localNewItem.sentence} onChange={e => setLocalNewItem({ ...localNewItem, sentence: e.target.value })} placeholder="例文（解答箇所を（ ）で囲む）" style={{ flex: 2 }} />
                        <button type="submit" className="btn btn-primary">追加</button>
                    </div>
                ) : (
                    <div className="input-group-horizontal">
                        <input type="text" className="input-field" value={localNewItem.word} onChange={e => setLocalNewItem({ ...localNewItem, word: e.target.value })} placeholder="英単語・表現" />
                        <input type="text" className="input-field" value={localNewItem.meaning} onChange={e => setLocalNewItem({ ...localNewItem, meaning: e.target.value })} placeholder="意味" style={{ flex: 2 }} />
                        <button type="submit" className="btn btn-primary">追加</button>
                    </div>
                )}
            </form>

            <div className="glass table-container">
                <table className="data-table">
                    <thead>
                        {appMode === 'Kanji' ? (
                            <tr><th>漢字</th><th>読み</th><th>例文</th><th style={{ width: '80px' }}>操作</th></tr>
                        ) : (
                            <tr><th>英単語・表現</th><th>意味</th><th style={{ width: '80px' }}>操作</th></tr>
                        )}
                    </thead>
                    <tbody>
                        {data.map((item, i) => (
                            <tr key={i}>
                                {appMode === 'Kanji' ? (
                                    <>
                                        <td>{item.kanji}</td>
                                        <td>{item.reading}</td>
                                        <td style={{ fontSize: '0.9rem' }}>{item.sentence}</td>
                                    </>
                                ) : (
                                    <>
                                        <td>{item.word}</td>
                                        <td>{item.meaning}</td>
                                    </>
                                )}
                                <td><button className="btn btn-danger btn-small" onClick={() => deleteItem(i)}>削除</button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const renderHistory = () => (
        <div className="fade-in container-narrow">
            <header className="view-header">
                <h2>学習履歴</h2>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-outline btn-small" onClick={exportHistory}>書出</button>
                    <button className="btn btn-outline btn-small" onClick={() => historyImportRef.current.click()}>読込</button>
                    <input type="file" ref={historyImportRef} style={{ display: 'none' }} accept=".json" onChange={handleHistoryImport} />
                    <button className="btn btn-outline" onClick={() => setView('setup')}>戻る</button>
                </div>
            </header>
            <div className="history-list">
                {history.length === 0 ? (
                    <div className="glass text-center" style={{ padding: '3rem' }}>履歴がありません</div>
                ) : history.map((record) => (
                    <div key={record.id} className="glass history-card">
                        <div className="history-top">
                            <span className="history-date">{record.date}</span>
                            <span className="history-mode">{record.mode}</span>
                        </div>
                        <div className="history-bottom">
                            <span className="history-set">{record.setName}</span>
                            <span className="history-score">{record.correct} / {record.total}</span>
                        </div>
                        {record.mistakes && record.mistakes.length > 0 && (
                            <div className="history-mistakes" style={{ marginTop: '1rem', borderTop: '1px solid var(--glass-border)', paddingTop: '1rem' }}>
                                <details>
                                    <summary style={{ cursor: 'pointer', fontWeight: 'bold', color: 'var(--accent)' }}>間違えた問題を表示 ({record.mistakes.length}問)</summary>
                                    <div className="mistakes-list history-mistakes-list" style={{ marginTop: '1rem' }}>
                                        {record.mistakes.map((m, i) => {
                                            const isKanjiMistake = !!m.kanji;
                                            const mode = record.mode;
                                            let answer = "";
                                            if (isKanjiMistake) {
                                                answer = mode.includes('書き') ? m.kanji : m.reading;
                                            } else {
                                                answer = mode.includes('英 ➜ 日') ? m.meaning : m.word;
                                            }

                                            return (
                                                <div key={i} className="mistake-item" style={{ padding: '1rem', marginBottom: '0.8rem' }}>
                                                    <div className="mistake-sentence" style={{ fontSize: '1rem' }}>{isKanjiMistake ? m.sentence : m.word}</div>
                                                    <div className="mistake-answer" style={{ fontSize: '1rem', marginTop: '0.5rem' }}>
                                                        あなたの回答: <span style={{ color: 'var(--danger)', borderBottom: 'none', marginRight: '1rem' }}>{m.userAnswer || '(判定のみ)'}</span>
                                                        正解: <span>{answer}</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </details>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );

    const renderHelp = () => (
        <div className="fade-in container-wide">
            <header className="view-header">
                <h2>使い方・機能説明</h2>
                <button className="btn btn-outline" onClick={() => setView('setup')}>トップへ戻る</button>
            </header>
            <div className="glass card readme-content markdown-body">
                <ReactMarkdown>{readmeText}</ReactMarkdown>
            </div>
            <button className="btn btn-primary btn-large" style={{ width: '100%', marginTop: '1rem' }} onClick={() => setView('setup')}>トップへ戻る</button>
        </div>
    );

    return (
        <div className="app-wrapper">
            {view === 'setup' && renderSetup()}
            {view === 'quiz' && renderQuiz()}
            {view === 'result' && renderResult()}
            {view === 'manage' && renderManage()}
            {view === 'history' && renderHistory()}
            {view === 'set-list' && renderSetList()}
            {view === 'help' && renderHelp()}
            {renderModal()}
        </div>
    );
};

export default App;
