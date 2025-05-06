import numpy as np
import matplotlib.pyplot as plt
import math

# Define the function
def function(x, y):
    return np.cos(x * y)

sample_num = [100, 200, 300, 400] # 100

# Plot heatmap
plt.figure(figsize=(25, 25))

def Plot(sample_num, i):

    # Create x and y values
    x = np.linspace(0, 30 * math.pi, sample_num)
    y = np.linspace(0, 30 * math.pi, sample_num)

    # Create meshgrid for x and y
    X, Y = np.meshgrid(x, y)

    # Calculate Z values based on the function
    Z = function(X, Y)

    plt.subplot(221+i)
    contour = plt.contour(X, Y, Z, 20, cmap='viridis')
    plt.colorbar(contour, label='cos(x * y)')
    plt.title(f"Contour Plot of cos(x * y) with {sample_num} samples")
    plt.xlabel("x")
    plt.ylabel("y")


for i in range(4):
    Plot(sample_num[i], i)

plt.show()