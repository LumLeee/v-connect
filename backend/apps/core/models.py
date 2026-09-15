from django.db import models


class Skill(models.Model):
    slug = models.SlugField(unique=True)
    name = models.CharField(max_length=100)

    class Meta:
        ordering = ["name", "id"]
        verbose_name = "Kỹ năng"
        verbose_name_plural = "Kỹ năng"

    def __str__(self):
        return self.name
