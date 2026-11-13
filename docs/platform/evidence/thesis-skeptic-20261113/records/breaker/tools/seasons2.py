import json,math,datetime as dt,statistics as st
raw=json.load(open('RAW_JSON'))
SIGNS=['aries','taurus','gemini','cancer','leo','virgo','libra','scorpio','sagittarius','capricorn','aquarius','pisces']
d0=dt.date(2016,1,1)
# spot check vs live refetch
for a in ['Aquarius','Gemini','Capricorn','Aries']:
    live=json.load(open(f'TMP/wm/{a}-10y.json'))['items']
    v=raw['signs'][a.lower()]['views']; mm=0
    for it in live:
        d=dt.datetime.strptime(it['timestamp'][:8],'%Y%m%d').date()
        if v[(d-d0).days]!=it['views']: mm+=1
    print(a,'live days',len(live),'mismatches vs committed raw',mm)
def sunlon(d): # low-precision apparent solar longitude at noon UTC (Astronomical Almanac)
    n=(dt.datetime(d.year,d.month,d.day,12)-dt.datetime(2000,1,1,12)).total_seconds()/86400
    L=(280.460+0.9856474*n)%360; g=math.radians((357.528+0.9856003*n)%360)
    return (L+1.915*math.sin(g)+0.020*math.sin(2*g))%360
def sign(d): return SIGNS[int(sunlon(d)//30)]
days=[d0+dt.timedelta(i) for i in range((dt.date(2025,12,31)-d0).days+1)]
sg=[sign(d) for d in days]
tot=0;rows=[]
for s in SIGNS:
    v=raw['signs'][s]['views']
    byyear={}
    for i,d in enumerate(days): byyear.setdefault(d.year,[]).append((v[i],sg[i]==s))
    nin=[];nout=[];peryear=[];lifted=0;rin=[];rout=[]
    for y,xs in byyear.items():
        med=st.median([x for x,_ in xs])
        yi=[x/med for x,f in xs if f]; yo=[x/med for x,f in xs if not f]
        nin+=yi;nout+=yo; rin+=[x for x,f in xs if f]; rout+=[x for x,f in xs if not f]
        peryear.append(round((st.mean(yi)/st.mean(yo)-1)*100))
        if st.median(yi)>st.median(yo): lifted+=1
    tot+=lifted
    lift=(st.mean(nin)/st.mean(nout)-1)*100
    plain=(st.mean(rin)/st.mean(rout)-1)*100
    # trimmed: drop top 1% of normalised days in each group
    tr=lambda a: sorted(a)[:int(len(a)*0.99)]
    trim=(st.mean(tr(nin))/st.mean(tr(nout))-1)*100
    print(f'{s:12s} lift {lift:6.2f} plain {plain:6.2f} trimmed1% {trim:6.2f} yrsLifted {lifted} per-year {peryear} min/med/max {min(peryear)}/{st.median(peryear)}/{max(peryear)}')
print('lifted sign-years',tot)
