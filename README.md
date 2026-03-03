# Logistics pricing engine



```bash
python -m unittest -v
```



```python
from logistics_engine import LogisticsCalculator

calc = LogisticsCalculator()
result = calc.calculate(weight_kg=12500, volume_m3=22, usd_rub_rate=92.5)
print(result)
```

## Note on heavy fixed step table

The source logic says that the "heavy" competitor fixed surcharge table is separate,
but exact values were not included. In this implementation, the heavy table defaults
to the light breakpoints until real heavy values are provided.
