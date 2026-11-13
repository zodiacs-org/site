import json,math,datetime as dt,statistics as st
raw=json.load(open('RAW_JSON'))
SIGNS=['aries','taurus','gemini','cancer','leo','virgo','libra','scorpio','sagittarius','capricorn','aquarius','pisces']
d0=dt.date(2016,1,1)
def sunlon(d):
    n=(dt.datetime(d.year,d.month,d.day,12)-dt.datetime(2000,1,1,12)).total_seconds()/86400
    L=(280.460+0.9856474*n)%360; g=math.radians((357.528+0.9856003*n)%360)
    return (L+1.915*math.sin(g)+0.020*math.sin(2*g))%360
def sign(d): return SIGNS[int(sunlon(d)//30)]
for Y in (2025,2023,2019):
    days=[dt.date(Y,1,1)+dt.timedelta(i) for i in range(365)]
    print(Y,'rows = article, cols = Sun window; value = mean reads in window / mean reads in rest of year - 1 (%)')
    print(' '*12+' '.join(f'{w[:3]:>5}' for w in SIGNS))
    for s in SIGNS:
        v=raw['signs'][s]['views']; out=[]
        for w in SIGNS:
            a=[v[(d-d0).days] for d in days if sign(d)==w]; b=[v[(d-d0).days] for d in days if sign(d)!=w]
            out.append(round((st.mean(a)/st.mean(b)-1)*100))
        print(f'{s:12s}'+' '.join(f'{x:5d}' for x in out))
# pooled: same lift measure with all-sign total removed (each sign's share of the twelve-article total that day)
days=[d0+dt.timedelta(i) for i in range((dt.date(2025,12,31)-d0).days+1)]
tot=[sum(raw['signs'][s]['views'][i] for s in SIGNS) for i in range(len(days))]
print('share-of-twelve lift (in-season mean share / out-of-season mean share - 1):')
for s in SIGNS:
    v=raw['signs'][s]['views']
    a=[v[i]/tot[i] for i,d in enumerate(days) if sign(d)==s]; b=[v[i]/tot[i] for i,d in enumerate(days) if sign(d)!=s]
    print(f'  {s:12s}{(st.mean(a)/st.mean(b)-1)*100:6.1f}')
