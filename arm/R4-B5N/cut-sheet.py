from reportlab.pdfgen.canvas import Canvas
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from pathlib import Path
from collections import Counter
from math import sin,cos,pi
import argparse

parser = argparse.ArgumentParser()
parser.add_argument('--font', required=True, help='Korean TrueType font file')
args = parser.parse_args()
O = Path(__file__).resolve().parent
pdfmetrics.registerFont(TTFont('Kr',args.font))
c=Canvas(str(O/'02-A3-재단도.pdf'),pagesize=(420*mm,297*mm));c.setViewerPreference('PrintScaling','None')
counts=Counter(); boxes=[];page=0
def txt(x,y,s,size=8):
 c.setFillColorRGB(.12,.24,.31);c.setFont('Kr',size);c.drawString(x*mm,(297-y)*mm,s)
def line(x,y,X,Y):
 c.line(x*mm,(297-y)*mm,X*mm,(297-Y)*mm)
def rect(x,y,w,h):c.rect(x*mm,(297-y-h)*mm,w*mm,h*mm)
def circ(x,y,r):c.circle(x*mm,(297-y)*mm,r*mm)
def pilot(x,y):
 c.saveState();c.setStrokeColorRGB(.1,.45,.65);line(x-2,y,x+2,y);line(x,y-2,x,y+2);c.restoreState()
def reg(k,x,y,w,h):
 assert 6<=x and x+w<=414 and y>=6 and y+h<=291,(k,x,y,w,h)
 for X,Y,W,H in boxes:assert x+w<=X or X+W<=x or y+h<=Y or Y+H<=y,(page,k,x,y,X,Y)
 boxes.append((x,y,w,h));counts[k]+=1
 return f'{k}.{counts[k]}'
def R(k,x,y,w,h,holes=(),tag=True):
 n=reg(k,x,y,w,h);rect(x,y,w,h)
 if tag:txt(x+1.6,y+min(5,h*.7),n,6.2)
 for a,b in holes:pilot(x+a,y+b)
def D(k,x,y,r,inner=0,marker=False):
 n=reg(k,x-r,y-r,2*r,2*r);circ(x,y,r)
 if inner:circ(x,y,inner)
 if marker:pilot(x,y)
 txt(x-r*.66,y+r*.53,n,5 if r<22 else 8)
def T(k,x,y,w,h):
 n=reg(k,x,y,w,h);line(x,y,x,y+h);line(x,y+h,x+w,y+h);line(x+w,y+h,x,y);txt(x+1,y+h-2,n,6)
def start(name,base=False):
 global page,boxes
 page+=1;boxes=[];c.setLineWidth(.48);x=300 if base else 10
 txt(x,14,f'R4 × B5N   /   {page:02d}   {name}',13)
 if not base:txt(x,22,'검정 실선 재단   ·   파란 십자 송곳 중심   ·   부품 ID 뒤 숫자는 낱장 번호   ·   단위 mm',8)
def end():
 line(305,282,405,282);line(305,280,305,284);line(405,280,405,284);txt(305,289,'100 mm  |  A3 가로 100%  |  각 쪽 1부',8);c.showPage()
for j in range(2):
 start('고정 받침',True);R('F',8,8,280,280);pilot(148,148)
 if j==0:
  for sign in [-1,1]:pilot(48,148+80*sign)
  for deg in [0,120,240]:
   t=deg*pi/180;pilot(148+72*cos(t),148+72*sin(t));pilot(148+98*cos(t),148+98*sin(t))
 for i,s in enumerate(['F   280 × 280, 2장 적층','위아래 골 방향을 90° 교차','중앙 십자에 종이축 부착','상판 뒤쪽 십자 2개는','회전 실 가이드 위치','반지름 72 / 98 십자에는','받침 패드 / 들림방지 몸통 부착']):txt(301,35+i*9,s,9)
 end()
start('회전 원판과 지지대')
D('Y',92,115,80,5.5);D('Y',261,115,80,5.5)
for i in range(3):R('P',10+32*i,212,24,14)
for i in range(9):R('K',10+33*i,236,26,24)
for i in range(6):R('H',10+i*43,265,38,12)
for sign in [-1,1]:pilot(261+72*cos(pi/5),115+sign*72*sin(pi/5))
txt(12,202,'Y   Ø160 / 중심 Ø11 예시. 두 장 적층 후 테두리 중앙에 실 홈을 얕게 누름. Y.2의 바깥 십자는 매듭 위치.',9);end()
start('기둥과 밑동')
for i in range(4):
 x=10+(i%2)*200;y=30+(i//2)*61;R('C',x,y,187,54,[(125,32),(165,32)])
for i in range(2):R('E',10+i*82,158,76,54,[(19,32),(59,32)])
for i in range(8):T('G',10+i*41,219,30,45)
for i in range(2):R('X',184+i*61,160,54,28)
txt(10,275,'C 왼쪽이 밑동. E 왼쪽을 C의 밑동에서 106에 맞춤. C 골은 긴 변 방향, E 골은 그와 직각.',8);end()
start('속 빈 위·아래 링크')
for i in range(2):
 R('U',10,32+i*31,255,24,[(60,12),(240,12)])
 pilot(15,44+i*31)
 R('L',10,96+i*31,210,24,[(15,12),(195,12)])
 R('UT',10,159+i*25,255,20);R('LT',10,213+i*25,210,20)
for i in range(8):R('J',282+i%3*33,36+i//3*32,28,21,[(14,10.5)])
txt(281,149,'U 꼬리 끝에서 5 mm에 올림 실 고정.',8)
txt(281,160,'U·L의 양 피벗 중심 거리 180.',8)
txt(281,171,'UT·LT는 측판 사이에 끼움.',8)
txt(281,182,'골 방향은 모두 긴 변과 평행.',8)
end()
start('끝단과 조작판')
R('CP',10,32,212,118)
for i in range(5):
 for sign in ([-1,1] if i!=1 else [0]):pilot(34+i*41+sign*7,46)
 txt(17+i*41,132,['받침','올림','손목','실 A','실 B'][i],9)
for i in range(4):R('Q',10+i*49,167,40,68,[(14,14),(14,54)])

for x in [235,305]:R('N',x,32,60,68);rect(x+15,34,30,10)
for i in range(2):R('S',235+i*75,117,68,24);R('T',235+i*75,152,68,30)
for i in range(4):R('V',235+i*36,198,24,9)
for i in range(4):T('Z',235+i*36,221,25,20)
txt(12,251,'조작판 CP는 짧은 변이 실의 당김 방향. Q는 두 장씩, V도 두 장씩 적층. N의 사각 창은 실 통과구.',9);end()
start('손목 링과 장착 기둥')
for i in range(2):D('W',41+61*i,68,25,13);D('R',172+49*i,68,20,8)
D('FL',281,68,15,8)
for i in range(4):R('SP',10+i*20,113,10,4,tag=False)
txt(10,126,'SP ×4   |   2장씩 + 종이 심',8)
for i in range(2):R('M',108+i*41,110,30,20);R('I',202+i*30,110,18,20)
for i in range(2):R('EQ',10+i*40,155,30,10,[(4,5),(15,5),(26,5)])
for i,r in enumerate([10,8,10]):D('B'+str(r),128+i*27,162,r,0,True)
for i in range(2):R('TEST',12+90*i,202,80,22,[(12,11),(36,11),(60,11)])
txt(12,240,'TEST 두 장은 끼움 확인용. 튜브·종이축·조작 손잡이·매듭 받침은 제작 시트 기준으로 현물 맞춤.',9)
txt(12,251,'R 두 겹은 외주에 반대 방향 실 홈과 고정점을 표시한 뒤 조립. 목은 라이너를 말아 Ø24 / Ø16에 맞춤.',9)
end();c.save();print(dict(counts),sum(counts.values()))
