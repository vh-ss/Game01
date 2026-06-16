package  
{
	import flash.geom.Point;
	import net.flashpunk.Entity;
	import net.flashpunk.graphics.Image;
	import net.flashpunk.FP;
	/**
	 * ...
	 * @author vadim
	 */
	public class House extends Entity 
	{
		[Embed(source = '../assets/graphics/house1.png')] public const HOUSE_GRAPHIC1:Class;
		[Embed(source = '../assets/graphics/house2.png')] public const HOUSE_GRAPHIC2:Class;
		[Embed(source='../assets/graphics/house3.png')] public const HOUSE_GRAPHIC3:Class;
		public function House(position:Point) 
		{
			x = position.x;
			y = position.y;
			switch (FP.rand(3))
			{
				case 0 :graphic = new Image(HOUSE_GRAPHIC1);				break;
				case 1 :graphic = new Image(HOUSE_GRAPHIC2);				break;
				case 2 :graphic = new Image(HOUSE_GRAPHIC3);				break;
			}
			
			
			setHitbox(96, 64, -FP.screen.x, -FP.screen.y-32);
			type = "house";
			
		}
		
		override public function update():void 
		{
			collisions();
			super.update();
		}
		
		private function collisions():void
		{
			
		}
		}
	}
	

}