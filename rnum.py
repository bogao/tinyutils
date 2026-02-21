def dku(n1, n2):
    if (n1==1):
        return 3
    if (n2==1):
        return pow(3, n1)
    return dku(dku(n1-1, n2), n2-1)

print(dku(3, 2))

'''
gnum = dku(3, 4)
for _ in range(63):
    gnum = dku(3, gnum)
for vi in range(gnum):
    print("hello world")
'''