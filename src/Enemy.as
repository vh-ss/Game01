package  
{
	import flash.geom.Point;
	import net.flashpunk.Entity;
	import net.flashpunk.graphics.Image;
	import net.flashpunk.FP;
	//import net.flashpunk.utils.Input;
	
	/**
	 * ...
	 * @author vadim
	 */
	public class Enemy extends Entity 
	{
		[Embed(source = '../assets/graphics/enemy2.png')] public const ENEMY_GRAPHIC:Class;
		
		public function Enemy(position:Point) 
		{
			x = position.x;
			y = position.y;
			graphic = new Image(ENEMY_GRAPHIC);
			
			setHitbox(24, 32, -FP.screen.x, -FP.screen.y);
			type = "enemy";
		}
		
		override public function update():void 
		{
			collisions();
			//x += (FP.rand(200) -FP.rand(200)) * FP.elapsed;
			//y += (FP.rand(200) -FP.rand(200)) * FP.elapsed;
			super.update();
		}
		
		private function collisions():void 
		{
			
			if (collide("player", x, y))
			{
				Assets.UpdateHealth( -1);
				
			}
		}
	}

}